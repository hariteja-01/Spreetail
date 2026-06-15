'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function AddMemberForm({ groupId }: { groupId: string }) {
  const [name, setName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsAdding(true);
    setError('');

    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
      });

      if (res.ok) {
        setName('');
        router.refresh(); // Refresh the server component to load new members
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to add member');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while adding the member');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="mt-4 p-4 bg-slate-900/50 rounded-xl border border-white/5">
      <h3 className="text-sm font-semibold text-slate-300 mb-3">Add New Member</h3>
      <form onSubmit={handleAddMember} className="flex gap-3 items-start">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Enter member's name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isAdding}
            className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 text-slate-100 outline-none text-sm"
          />
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </div>
        <Button 
          type="submit" 
          disabled={!name.trim() || isAdding}
          className="bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-500/20 whitespace-nowrap"
        >
          {isAdding ? 'Adding...' : 'Add Member'}
        </Button>
      </form>
    </div>
  );
}
