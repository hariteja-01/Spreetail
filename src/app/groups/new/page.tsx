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
    <div className="max-w-2xl mx-auto p-6 mt-10 bg-white rounded-xl shadow-md">
      <h1 className="text-2xl font-bold mb-6">Create New Group</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Group Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 mt-1 border rounded-md"
            placeholder="e.g. Goa Trip 2026"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Base Currency</label>
          <select 
            value={currency} 
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-3 py-2 mt-1 border rounded-md"
          >
            <option value="INR">INR (₹)</option>
            <option value="USD">USD ($)</option>
          </select>
        </div>
        <div className="flex gap-4">
          <Button type="submit">Create Group</Button>
          <Link href="/dashboard">
            <Button variant="outline" type="button">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
