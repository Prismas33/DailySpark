'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
export const dynamic = 'force-dynamic';

export default function SignIn() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check if already signed in via Firebase
    (async () => {
      const { auth } = await import('@/lib/firebase');
      const unsub = onAuthStateChanged(auth, (user) => {
        if (user) {
          router.push('/dashboard');
        } else {
          setLoading(false);
        }
      });
      return () => unsub();
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-gradient-to-r from-orange-400 via-amber-500 to-yellow-500 rounded-xl p-6 mb-6 shadow-lg">
            <div className="flex items-center justify-center space-x-3">
              <div className="text-3xl">✨</div>
              <div>
                <h1 className="text-2xl font-bold text-white">DailySpark</h1>
                <p className="text-orange-100 text-sm">Social Media Management Platform</p>
              </div>
            </div>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Sign in to your account</h2>
          <p className="text-gray-400">Enter your credentials to continue</p>
        </div>

        {/* Email/Password */}
        <div className="bg-gray-900/60 border border-gray-700/50 rounded-2xl p-6 mb-6">
          <h3 className="text-white font-semibold mb-4">Sign in with email</h3>
          {error && (
            <div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>
          )}
          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 bg-gray-800/60 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 bg-gray-800/60 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
            />
            <button
              onClick={async () => {
                setError(null);
                try {
                  const { auth } = await import('@/lib/firebase');
                  await signInWithEmailAndPassword(auth, email, password);
                  router.push('/dashboard');
                } catch (err: any) {
                  const code = err?.code || '';
                  if (code.includes('invalid-credential') || code.includes('wrong-password')) setError('Invalid credentials');
                  else if (code.includes('user-not-found')) setError('User not found');
                  else setError('Sign in failed');
                }
              }}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3 rounded-xl font-semibold hover:from-emerald-600 hover:to-teal-700"
            >
              Sign in
            </button>
            <div className="flex items-center justify-center text-sm">
              <a href="/auth/reset-password" className="text-emerald-400 hover:underline">Forgot password?</a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-gray-400 text-sm">
          <p>By signing in, you agree to our Terms of Service and Privacy Policy</p>
        </div>
      </div>
    </div>
  );
}
