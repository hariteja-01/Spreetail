'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { parseExpensesCsv, ParsedAnomaly, NormalizedExpense } from '@/lib/csvParser';
import Link from 'next/link';

import { use } from 'react';

export default function ImportCsvPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<{ expenses: NormalizedExpense[], globalAnomalies: ParsedAnomaly[] } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleParse = async () => {
    if (!file) return;
    try {
      const text = await file.text();
      const result = await parseExpensesCsv(text);
      setParsedData(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to parse CSV');
    }
  };

  const handleImport = async () => {
    if (!parsedData) return;
    setIsImporting(true);
    
    // Extract all anomalies across all expenses plus global ones
    const allAnomalies = [...parsedData.globalAnomalies];
    parsedData.expenses.forEach(exp => {
      allAnomalies.push(...exp.anomalies);
    });

    try {
      const res = await fetch(`/api/groups/${params.id}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expenses: parsedData.expenses,
          anomalies: allAnomalies
        })
      });

      if (res.ok) {
        router.push(`/groups/${params.id}`);
        router.refresh();
      } else {
        setError('Import failed on server');
      }
    } catch (err) {
      setError('Import request failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadReport = () => {
    if (!parsedData) return;
    
    let reportText = "FairShare Import Report\n=======================\n\n";
    
    if (parsedData.globalAnomalies.length > 0) {
      reportText += "Global Anomalies:\n";
      parsedData.globalAnomalies.forEach(anom => {
        reportText += `- Row ${anom.rowNumber}: [${anom.issueType}] -> ${anom.resolution}\n`;
      });
      reportText += "\n";
    }

    reportText += "Expense Anomalies:\n";
    parsedData.expenses.forEach(exp => {
      if (exp.anomalies.length > 0) {
        reportText += `\nRow ${exp.rowNumber}: ${exp.description} (Paid by ${exp.paidByStr})\n`;
        exp.anomalies.forEach(anom => {
          reportText += `  - [${anom.severity}] ${anom.issueType}: ${anom.resolution}\n`;
        });
      }
    });

    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import_report.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-sky-400">Import Expenses</h1>
        <Link href={`/groups/${params.id}`}>
          <Button variant="outline" className="border-white/20 hover:bg-white/10">Back to Group</Button>
        </Link>
      </div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl space-y-4 p-8">
        {!parsedData ? (
          <div className="space-y-6">
            <div className="border-2 border-dashed border-white/20 rounded-xl p-12 text-center hover:bg-white/5 transition-colors">
              <input 
                type="file" 
                accept=".csv" 
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-6 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-500/20 file:text-teal-300 hover:file:bg-teal-500/30 cursor-pointer mx-auto max-w-sm"
              />
            </div>
            <div className="flex justify-center">
              <Button onClick={handleParse} disabled={!file} className="bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-500/20 px-8 py-2 text-lg rounded-full">Parse CSV</Button>
            </div>
            {error && <p className="text-red-400 text-center font-medium">{error}</p>}
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold border-b border-white/10 pb-4 text-slate-100">Anomaly Review Wizard</h2>
            
            <div className="bg-amber-900/20 border-l-4 border-amber-500 p-4 mb-6 rounded-r-xl">
              <p className="text-sm text-amber-200 font-medium">
                We detected some anomalies in your messy CSV data. Please review how we plan to resolve them before committing.
              </p>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {parsedData.globalAnomalies.map((anom, i) => (
                 <div key={`global-${i}`} className="p-4 border border-red-500/30 bg-red-900/20 rounded-xl">
                   <div className="font-semibold text-red-400">Row {anom.rowNumber}: {anom.issueType}</div>
                   <div className="text-sm text-red-300/80 mt-1">Action: {anom.resolution}</div>
                 </div>
              ))}

              {parsedData.expenses.map((exp, i) => (
                <div key={`exp-${i}`} className="border border-white/10 bg-white/5 rounded-xl p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-200 text-lg">Row {exp.rowNumber}: {exp.description}</span>
                    <span className="text-sm text-slate-400 font-medium">{new Date(exp.date).toLocaleDateString()}</span>
                  </div>
                  <div className="text-sm text-slate-300">
                    Paid by <span className="text-teal-300 font-semibold">{exp.paidByStr}</span>: <span className="font-mono">{exp.amount} {exp.currency}</span>
                  </div>
                  
                  {exp.anomalies.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {exp.anomalies.map((anom, j) => (
                        <div key={j} className={`text-xs p-3 rounded-lg border ${anom.severity === 'WARNING' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : anom.severity === 'CONFLICT' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-sky-500/10 text-sky-300 border-sky-500/20'}`}>
                          <strong className="font-bold">{anom.issueType}:</strong> {anom.resolution}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-4 pt-6 border-t border-white/10">
              <Button onClick={handleImport} disabled={isImporting} className="bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-500/20 px-8">
                {isImporting ? 'Importing...' : 'Approve & Import'}
              </Button>
              <Button onClick={handleDownloadReport} variant="secondary" className="bg-slate-700 hover:bg-slate-600 text-white shadow-lg shadow-slate-900/20 px-6">
                Download Report as Text
              </Button>
              <Button variant="outline" onClick={() => setParsedData(null)} className="border-white/20 hover:bg-white/10">Cancel</Button>
            </div>
            {error && <p className="text-red-400 font-medium">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
