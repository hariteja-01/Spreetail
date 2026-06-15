'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function NewGroupPage() {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('INR');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, currency })
    });

    if (res.ok) {
      const { group } = await res.json();
      router.push(`/groups/${group.id}`);
      router.refresh();
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8 mt-10 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
      <h1 className="text-3xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-sky-400">Create New Group</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Group Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-900/50 border border-white/10 rounded-lg focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 text-slate-100 transition-all outline-none"
            placeholder="e.g. Goa Trip 2026"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Base Currency</label>
          <select 
            value={currency} 
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-900/50 border border-white/10 rounded-lg focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 text-slate-100 transition-all outline-none"
          >
            <option value="INR">INR (₹)</option>
            <option value="USD">USD ($)</option>
          </select>
        </div>
        <div className="flex gap-4 pt-4 border-t border-white/10">
          <Button type="submit" className="bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-500/20 px-8 py-2.5 rounded-xl">Create Group</Button>
          <Link href="/dashboard">
            <Button variant="outline" type="button" className="border-white/20 hover:bg-white/10 py-2.5 rounded-xl">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
