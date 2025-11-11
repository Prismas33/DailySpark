'use client';

export default function HomePage() {
  const go = (href: string) => () => { window.location.href = href; };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-gray-900/60 border border-gray-700/50 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">✨</div>
          <h1 className="text-2xl font-bold text-white">DailySpark</h1>
          <p className="text-gray-400 text-sm">Social Media Management Platform</p>
        </div>
        <div className="space-y-3">
          <button onClick={go('/auth/signin')} className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3 rounded-xl font-semibold hover:from-emerald-600 hover:to-teal-700">Sign in</button>
        </div>
        <p className="text-center text-xs text-gray-500 mt-4">Forgot password? <a href="/auth/reset-password" className="text-emerald-400 hover:underline">Reset it</a></p>
      </div>
    </div>
  );
}
