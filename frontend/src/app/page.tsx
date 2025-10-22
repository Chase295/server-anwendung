'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect zu Dashboard oder Login
    const token = localStorage.getItem('auth_token');
    if (token) {
      router.push('/flows');
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">IoT & Voice Orchestrator</h1>
        <p className="text-gray-600 dark:text-gray-400">Lade...</p>
      </div>
    </div>
  );
}

