'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function DeleteGroupButton({ groupId }: { groupId: string }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this group? This action cannot be undone and will delete all associated expenses and settlements.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        router.push('/dashboard');
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete group');
        setIsDeleting(false);
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while deleting the group');
      setIsDeleting(false);
    }
  };

  return (
    <Button 
      variant="destructive" 
      onClick={handleDelete} 
      disabled={isDeleting}
      className="bg-red-600/80 hover:bg-red-600 text-white shadow-lg shadow-red-900/20 px-6 py-2 rounded-full font-medium"
    >
      {isDeleting ? 'Deleting...' : 'Delete Group'}
    </Button>
  );
}
