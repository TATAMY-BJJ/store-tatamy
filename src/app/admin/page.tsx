'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push('/admin/dashboard');
      } else {
        const data = await res.json();
        setError(data.error || 'Nesprávné heslo');
      }
    } catch {
      setError('Chyba při přihlašování');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-tatamy-gray">
      <Header />
      <main className="max-w-sm mx-auto px-4 py-20">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <h1 className="text-xl font-bold text-tatamy-black text-center mb-6">
            Přihlášení do administrace
          </h1>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Heslo
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Zadejte heslo..."
                className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm
                  focus:outline-none focus:ring-2 focus:ring-tatamy-red/30 focus:border-tatamy-red"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm text-tatamy-red text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-tatamy-red text-white py-3 rounded-lg font-medium
                hover:bg-tatamy-red-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Přihlašuji...' : 'Přihlásit se'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
