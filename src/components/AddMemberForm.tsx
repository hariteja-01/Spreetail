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
    <div className="mt-6 p-5 bg-white/10 backdrop-blur-md rounded-xl border border-teal-500/30 shadow-lg">
      <h3 className="text-sm font-bold text-teal-400 mb-3 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
        Add New Member
      </h3>
      <form onSubmit={handleAddMember} className="flex gap-3 items-start">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Type a new member's name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isAdding}
            className="w-full px-4 py-2.5 bg-slate-900/80 border border-teal-500/50 rounded-lg focus:ring-2 focus:ring-teal-400 focus:border-teal-400 text-slate-100 outline-none text-sm font-medium placeholder:text-slate-500 transition-all shadow-inner"
          />
          {error && <p className="text-red-400 text-xs mt-2 font-medium">{error}</p>}
        </div>
        <Button 
          type="submit" 
          disabled={!name.trim() || isAdding}
          className="bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold shadow-lg shadow-teal-500/30 whitespace-nowrap px-6"
        >
          {isAdding ? 'Adding...' : 'Add Member'}
        </Button>
      </form>
    </div>
  );
}
