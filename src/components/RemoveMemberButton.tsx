'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

export function RemoveMemberButton({ groupId, memberId }: { groupId: string, memberId: string }) {
  const [isRemoving, setIsRemoving] = useState(false);
  const router = useRouter();

  const handleRemove = async () => {
    if (!confirm('Are you sure you want to remove this member? Their historical expense splits will remain intact.')) {
      return;
    }

    setIsRemoving(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/members/${memberId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        router.refresh(); // Refresh the server component to update the leftAt date
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to remove member');
        setIsRemoving(false);
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while removing the member');
      setIsRemoving(false);
    }
  };

  return (
    <button
      onClick={handleRemove}
      disabled={isRemoving}
      className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 p-1 rounded-md transition-colors"
      title="Remove Member"
    >
      <X className="w-4 h-4" />
    </button>
  );
}
