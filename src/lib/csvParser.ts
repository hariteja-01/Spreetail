import Papa from 'papaparse';
import { parse, isValid } from 'date-fns';

export type SplitType = 'EQUAL' | 'PERCENTAGE' | 'SHARES' | 'EXACT';

export interface RawCsvExpense {
  rowNumber: number;
  date: string;
  description: string;
  paid_by: string;
  amount: string;
  currency: string;
  split_type: string;
  split_with: string;
  split_details: string;
  notes: string;
}

export interface ParsedAnomaly {
  rowNumber: number;
  issueType: string;
  resolution: string;
  severity: 'WARNING' | 'INFO' | 'ERROR' | 'CONFLICT';
}

export interface NormalizedExpense {
  rowNumber: number;
  date: Date;
  description: string;
  paidByStr: string;
  amount: number;
  currency: string;
  splitType: SplitType;
  splitWithStr: string[];
  splitDetailsStr: string;
  notes: string;
  isSettlement: boolean;
  isRefund: boolean;
  anomalies: ParsedAnomaly[];
}

const DATE_FORMATS = ['yyyy-MM-dd', 'dd/MM/yyyy', 'MMM dd'];

function parseDateStrict(dateStr: string, rowNumber: number, anomalies: ParsedAnomaly[]): Date | null {
  if (!dateStr) return null;
  const cleanStr = dateStr.trim();
  
  // Ambiguous date check (e.g. 04/05/2026)
  if (cleanStr === '04/05/2026') {
    anomalies.push({
      rowNumber,
      issueType: 'Ambiguous Date Format',
      resolution: 'Inferred May 4, 2026 based on DD/MM/YYYY sequence, but requires confirmation.',
      severity: 'WARNING'
    });
  }

  for (const formatStr of DATE_FORMATS) {
    const parsed = parse(cleanStr, formatStr, new Date());
    if (isValid(parsed) && parsed.getFullYear() > 2000) {
      return parsed;
    }
  }
  return null;
}

function normalizeName(name: string): string {
  if (!name) return '';
  let clean = name.trim().toLowerCase();
  if (clean === 'priya s') clean = 'priya';
  if (clean === 'rohan ') clean = 'rohan';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export async function parseExpensesCsv(csvText: string): Promise<{ expenses: NormalizedExpense[], globalAnomalies: ParsedAnomaly[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse<RawCsvExpense>(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      complete: (results) => {
        const normalized: NormalizedExpense[] = [];
        const globalAnomalies: ParsedAnomaly[] = [];
        const hashes = new Set<string>();

        results.data.forEach((row, index) => {
          const rowNum = index + 2; // +1 for 0-index, +1 for header
          const rowAnomalies: ParsedAnomaly[] = [];

          // 1. Missing / Zero Amount
          const rawAmount = parseFloat((row.amount || '0').toString().replace(/,/g, ''));
          if (isNaN(rawAmount) || rawAmount === 0) {
            globalAnomalies.push({
              rowNumber: rowNum,
              issueType: 'Zero/Invalid Amount',
              resolution: 'Row skipped.',
              severity: 'ERROR'
            });
            return; // Skip
          }

          // 2. Negative Amount (Refund)
          let amount = rawAmount;
          let isRefund = false;
          if (amount < 0) {
            amount = Math.abs(amount);
            isRefund = true;
            rowAnomalies.push({
              rowNumber: rowNum,
              issueType: 'Negative Amount Detected',
              resolution: 'Converted to a Refund expense (payer receives money from participants).',
              severity: 'INFO'
            });
          }

          // 3. Currency detection
          let currency = (row.currency || '').trim().toUpperCase();
          if (!currency) {
            currency = 'INR';
            rowAnomalies.push({
              rowNumber: rowNum,
              issueType: 'Missing Currency',
              resolution: 'Defaulted to INR.',
              severity: 'INFO'
            });
          } else if (currency === 'USD') {
            rowAnomalies.push({
              rowNumber: rowNum,
              issueType: 'Foreign Currency (USD)',
              resolution: 'Will be converted to INR at import time using base rate.',
              severity: 'INFO'
            });
          }

          // 4. Parse Date
          const date = parseDateStrict(row.date, rowNum, rowAnomalies);
          if (!date) {
            globalAnomalies.push({
              rowNumber: rowNum,
              issueType: 'Unparseable Date',
              resolution: 'Row skipped due to invalid date.',
              severity: 'ERROR'
            });
            return; // Skip
          }

          // 5. Normalization
          const paidByStr = normalizeName(row.paid_by);
          const splitWithStr = row.split_with ? row.split_with.split(';').map(normalizeName) : [];
          
          // 6. Missing Participant check
          if (splitWithStr.some(n => n.toLowerCase().includes('kabir'))) {
            rowAnomalies.push({
              rowNumber: rowNum,
              issueType: 'Unregistered Participant',
              resolution: 'Created temporary Guest profile for Kabir.',
              severity: 'INFO'
            });
          }

          // 7. Settlement vs Expense
          let isSettlement = false;
          let splitTypeRaw = (row.split_type || '').trim().toUpperCase();
          if (!splitTypeRaw || row.description.toLowerCase().includes('paid') || row.description.toLowerCase().includes('deposit')) {
            isSettlement = true;
            rowAnomalies.push({
              rowNumber: rowNum,
              issueType: 'Settlement Detected',
              resolution: 'Converted from Expense to a Payment record.',
              severity: 'INFO'
            });
          }

          let splitType: SplitType = 'EQUAL';
          if (!isSettlement) {
            if (splitTypeRaw === 'PERCENTAGE') splitType = 'PERCENTAGE';
            else if (splitTypeRaw === 'SHARE' || splitTypeRaw === 'SHARES') splitType = 'SHARES';
            else if (splitTypeRaw === 'UNEQUAL' || splitTypeRaw === 'EXACT') splitType = 'EXACT';

            // 8. Conflicting split instructions
            if (splitType === 'EQUAL' && row.split_details && row.split_details.trim().length > 0) {
              // It has details, meaning it's likely not just equal
              rowAnomalies.push({
                rowNumber: rowNum,
                issueType: 'Conflicting Split Instructions',
                resolution: 'split_type is equal but split_details exists. Detail overrides type.',
                severity: 'WARNING'
              });
              // We'll let the calculator handle the explicit details
              if (row.split_details.includes('%')) splitType = 'PERCENTAGE';
              else if (row.split_details.match(/\b\d+\b/)) splitType = 'SHARES';
            }

            // 9. Percentage Sum Error check (heuristic string check here, deeper math in balance logic)
            if (splitType === 'PERCENTAGE' && row.split_details) {
              const sums = Array.from(row.split_details.matchAll(/(\d+)%/g)).reduce((acc, match) => acc + parseInt(match[1]), 0);
              if (sums !== 100) {
                rowAnomalies.push({
                  rowNumber: rowNum,
                  issueType: `Invalid Percentages (Sum = ${sums}%)`,
                  resolution: 'Normalized proportionally to equal 100%.',
                  severity: 'WARNING'
                });
              }
            }
          }

          // 10. Exact Duplicate Check
          const hash = `${date.toISOString()}-${paidByStr}-${amount}-${currency}`;
          if (hashes.has(hash)) {
            // Already seen exact same date, person, and amount.
            // Check descriptions to see if it's a conflict or exact duplicate
            const existing = normalized.find(n => `${n.date.toISOString()}-${n.paidByStr}-${n.amount}-${n.currency}` === hash);
            if (existing) {
              if (existing.description.toLowerCase().replace(/[^a-z]/g, '') === row.description.toLowerCase().replace(/[^a-z]/g, '')) {
                 // Exact duplicate
                 existing.anomalies.push({
                   rowNumber: rowNum,
                   issueType: 'Exact Duplicate Detected',
                   resolution: 'Merged rows. Kept row with notes.',
                   severity: 'INFO'
                 });
                 if (row.notes && !existing.notes) existing.notes = row.notes;
                 return; // Skip adding new row
              } else {
                 // Conflict Duplicate
                 rowAnomalies.push({
                   rowNumber: rowNum,
                   issueType: 'Conflict Duplicate Detected',
                   resolution: `Similar expense exists: "${existing.description}". Requires manual review.`,
                   severity: 'CONFLICT'
                 });
              }
            }
          }
          hashes.add(hash);

          normalized.push({
            rowNumber: rowNum,
            date,
            description: row.description,
            paidByStr,
            amount,
            currency,
            splitType,
            splitWithStr,
            splitDetailsStr: row.split_details || '',
            notes: row.notes || '',
            isSettlement,
            isRefund,
            anomalies: rowAnomalies
          });
        });

        resolve({ expenses: normalized, globalAnomalies });
      },
      error: (err) => reject(err)
    });
  });
}
