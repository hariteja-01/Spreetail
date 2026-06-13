'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { parseExpensesCsv, ParsedAnomaly, NormalizedExpense } from '@/lib/csvParser';
import Link from 'next/link';

export default function ImportCsvPage({ params }: { params: { id: string } }) {
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
    } catch (err) {
      setError('Failed to parse CSV');
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

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Import Expenses (CSV)</h1>
        <Link href={`/groups/${params.id}`}>
          <Button variant="outline">Back to Group</Button>
        </Link>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
        {!parsedData ? (
          <div className="space-y-4">
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <Button onClick={handleParse} disabled={!file}>Parse CSV</Button>
            {error && <p className="text-red-500">{error}</p>}
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold border-b pb-2">Anomaly Review Wizard</h2>
            
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
              <p className="text-sm text-yellow-700 font-medium">
                We detected some anomalies in your messy CSV data. Please review how we plan to resolve them before committing.
              </p>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {parsedData.globalAnomalies.map((anom, i) => (
                 <div key={`global-${i}`} className="p-3 border border-red-200 bg-red-50 rounded-md">
                   <div className="font-semibold text-red-700">Row {anom.rowNumber}: {anom.issueType}</div>
                   <div className="text-sm text-red-600">Action: {anom.resolution}</div>
                 </div>
              ))}

              {parsedData.expenses.map((exp, i) => (
                <div key={`exp-${i}`} className="border rounded-md p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Row {exp.rowNumber}: {exp.description}</span>
                    <span className="text-sm text-gray-500">{new Date(exp.date).toLocaleDateString()}</span>
                  </div>
                  <div className="text-sm text-gray-700">
                    Paid by {exp.paidByStr}: {exp.amount} {exp.currency}
                  </div>
                  
                  {exp.anomalies.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {exp.anomalies.map((anom, j) => (
                        <div key={j} className={`text-xs p-2 rounded ${anom.severity === 'WARNING' ? 'bg-orange-100 text-orange-800' : anom.severity === 'CONFLICT' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                          <strong>{anom.issueType}:</strong> {anom.resolution}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-4 pt-4">
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? 'Importing...' : 'Approve & Import'}
              </Button>
              <Button variant="outline" onClick={() => setParsedData(null)}>Cancel</Button>
            </div>
            {error && <p className="text-red-500">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
