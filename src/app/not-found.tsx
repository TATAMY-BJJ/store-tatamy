import Link from 'next/link';
import Header from '@/components/Header';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="text-6xl font-bold text-tatamy-red mb-4">404</h1>
        <p className="text-lg text-gray-500 mb-8">Krabice nenalezena</p>
        <Link
          href="/"
          className="inline-block bg-tatamy-black text-white px-6 py-3 rounded-lg font-medium hover:bg-tatamy-dark transition-colors"
        >
          Zpět na přehled skladu
        </Link>
      </main>
    </div>
  );
}
