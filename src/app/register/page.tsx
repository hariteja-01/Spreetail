'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      if (res.ok) {
        router.push('/dashboard');
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('An error occurred');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8">
        <h1 className="text-3xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-sky-400">FairShare</h1>
        <h2 className="text-xl font-semibold mb-6 text-slate-200">Register an account</h2>
        
        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-6 text-sm">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-900/50 border border-white/10 rounded-lg focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 text-slate-100 transition-all outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-900/50 border border-white/10 rounded-lg focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 text-slate-100 transition-all outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-900/50 border border-white/10 rounded-lg focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 text-slate-100 transition-all outline-none"
            />
          </div>
          <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-500/20 py-6 text-lg rounded-xl mt-4">Register</Button>
        </form>
        
        <p className="mt-6 text-center text-slate-400">
          Already have an account? <Link href="/login" className="text-teal-400 hover:text-teal-300 font-medium transition-colors">Login</Link>
        </p>
      </div>
    </div>
  );
}
