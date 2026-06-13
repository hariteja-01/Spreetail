import { GroupMember } from '@prisma/client';
import { NormalizedExpense, SplitType } from './csvParser';

export const USD_RATE = 83; // Fixed exchange rate as per DECISIONS.md

export interface BalanceDelta {
  userId: string;
  amountOwed: number; // Positive means user owes this amount, negative means user is owed
}

export function calculateSplits(
  expense: NormalizedExpense,
  groupMembers: GroupMember[],
  usersData: { id: string, name: string }[]
): BalanceDelta[] {
  // 1. Convert Currency to INR if needed
  let amount = expense.amount;
  if (expense.currency === 'USD') {
    amount = amount * USD_RATE;
  }

  // 2. Identify the payer ID
  const payer = usersData.find(u => u.name.toLowerCase() === expense.paidByStr.toLowerCase());
  if (!payer) {
    // If payer not found (e.g. Kabir), we'll have to assign or return empty
    // Handled in actual import logic by creating the user first
    return [];
  }

  // 3. Temporal Membership check: filter members who were active at the time of the expense
  const activeMembers = groupMembers.filter(m => {
    const joined = new Date(m.joinedAt).getTime();
    const expDate = expense.date.getTime();
    const left = m.leftAt ? new Date(m.leftAt).getTime() : null;
    
    return expDate >= joined && (left === null || expDate <= left);
  });

  // Check if someone was implicitly included in splitWithStr but not active
  // E.g., Meera included in April but left in March.
  const activeMemberIds = new Set(activeMembers.map(m => m.userId));
  
  // Find which active members are in the splitWith list
  const splitUsers = usersData.filter(u => 
    expense.splitWithStr.some(name => name.toLowerCase() === u.name.toLowerCase()) &&
    activeMemberIds.has(u.id)
  );

  if (splitUsers.length === 0) return [];

  const splits: BalanceDelta[] = [];
  const N = splitUsers.length;

  if (expense.isRefund) {
    // Payer received money. Therefore, payer owes the others their share.
    // Equivalent to a negative expense where everyone owes the payer a negative amount.
    const share = (amount / N);
    splitUsers.forEach(u => {
      splits.push({
        userId: u.id,
        amountOwed: u.id === payer.id ? 0 : -share // others are owed money by the payer
      });
    });
    return splits;
  }

  switch (expense.splitType) {
    case 'EQUAL': {
      const share = Math.round((amount / N) * 100) / 100;
      splitUsers.forEach(u => {
        splits.push({
          userId: u.id,
          amountOwed: u.id === payer.id ? share - amount : share
        });
      });
      break;
    }
    case 'PERCENTAGE': {
      // Parse details
      // Example details: "Aisha 30%; Rohan 30%; Priya 30%; Meera 20%"
      const pctMap = new Map<string, number>();
      let totalPct = 0;
      const parts = expense.splitDetailsStr.split(';');
      
      parts.forEach(part => {
        const match = part.trim().match(/([a-zA-Z\s]+)\s*(\d+)%/);
        if (match) {
          const name = match[1].trim().toLowerCase();
          const pct = parseInt(match[2], 10);
          const u = splitUsers.find(su => su.name.toLowerCase() === name);
          if (u) {
            pctMap.set(u.id, pct);
            totalPct += pct;
          }
        }
      });

      // Normalize if totalPct !== 100
      splitUsers.forEach(u => {
        let pct = pctMap.get(u.id) || 0;
        if (totalPct > 0) {
          pct = (pct / totalPct) * 100; // normalize
        } else {
          pct = (100 / N); // fallback
        }
        
        const share = Math.round((amount * (pct / 100)) * 100) / 100;
        splits.push({
          userId: u.id,
          amountOwed: u.id === payer.id ? share - amount : share
        });
      });
      break;
    }
    case 'SHARES': {
      // Details: "Aisha 2; Rohan 1; Priya 1"
      const shareMap = new Map<string, number>();
      let totalShares = 0;
      const parts = expense.splitDetailsStr.split(';');
      
      parts.forEach(part => {
        const match = part.trim().match(/([a-zA-Z\s]+)\s+(\d+)/);
        if (match) {
          const name = match[1].trim().toLowerCase();
          const s = parseInt(match[2], 10);
          const u = splitUsers.find(su => su.name.toLowerCase() === name);
          if (u) {
            shareMap.set(u.id, s);
            totalShares += s;
          }
        }
      });

      splitUsers.forEach(u => {
        const s = shareMap.get(u.id) || (totalShares === 0 ? 1 : 0);
        const t = totalShares === 0 ? N : totalShares;
        
        const share = Math.round((amount * (s / t)) * 100) / 100;
        splits.push({
          userId: u.id,
          amountOwed: u.id === payer.id ? share - amount : share
        });
      });
      break;
    }
    case 'EXACT': {
      // Details: "Rohan 700; Priya 400; Meera 400"
      const exactMap = new Map<string, number>();
      const parts = expense.splitDetailsStr.split(';');
      
      parts.forEach(part => {
        const match = part.trim().match(/([a-zA-Z\s]+)\s+(\d+)/);
        if (match) {
          const name = match[1].trim().toLowerCase();
          const amt = parseFloat(match[2]);
          const u = splitUsers.find(su => su.name.toLowerCase() === name);
          if (u) {
            exactMap.set(u.id, amt);
          }
        }
      });

      splitUsers.forEach(u => {
        const share = exactMap.get(u.id) || 0;
        splits.push({
          userId: u.id,
          amountOwed: u.id === payer.id ? share - amount : share
        });
      });
      break;
    }
  }

  return splits;
}
