'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import SocialMediaManager from '@/components/SocialMediaManager/SocialMediaManager';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function DashboardClient() {
  const router = useRouter();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const { auth } = await import('@/lib/firebase');
      unsub = onAuthStateChanged(auth, (user) => {
        setFirebaseUser(user);
        setLoading(false);
        if (!user) {
          router.push('/auth/signin');
        }
      });
    })();
    return () => { if (unsub) unsub(); };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-300">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return null; // Will redirect
  }

  return <SocialMediaManager />;
}
