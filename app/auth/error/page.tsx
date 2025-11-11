'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

const errorMessages = {
  Signin: 'Try signing in with a different account.',
  OAuthSignin: 'Try signing in with a different account.',
  OAuthCallback: 'Try signing in with a different account.',
  OAuthCreateAccount: 'Try signing in with a different account.',
  EmailCreateAccount: 'Try signing in with a different account.',
  Callback: 'Try signing in with a different account.',
  OAuthAccountNotLinked: 'To confirm your identity, sign in with the same account you used originally.',
  EmailSignin: 'The e-mail could not be sent.',
  CredentialsSignin: 'Sign in failed. Check the details you provided are correct.',
  SessionRequired: 'Please sign in to access this page.',
  default: 'Unable to sign in.',
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const errorParam = searchParams.get('error');
    setError(errorParam || 'default');
  }, [searchParams]);

  const getErrorMessage = (error: string): string => {
    return errorMessages[error as keyof typeof errorMessages] || errorMessages.default;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-gradient-to-r from-red-500 via-red-600 to-red-700 rounded-xl p-6 mb-6 shadow-lg">
            <div className="flex items-center justify-center space-x-3">
              <div className="text-3xl">⚠️</div>
              <div>
                <h1 className="text-2xl font-bold text-white">Authentication Error</h1>
                <p className="text-red-100 text-sm">Something went wrong</p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-red-300 mb-2">Sign in failed</h2>
          <p className="text-red-200 mb-4">{getErrorMessage(error)}</p>
          <p className="text-red-300 text-sm">Error code: {error}</p>
        </div>

        {/* Actions */}
        <div className="space-y-4">
          <button
            onClick={() => router.push('/auth/signin')}
            className="w-full bg-gradient-to-r from-orange-400 to-amber-500 text-white py-3 px-6 rounded-lg font-semibold hover:from-orange-500 hover:to-amber-600 transition-all transform hover:scale-105"
          >
            Try Again
          </button>
          
          <button
            onClick={() => router.push('/')}
            className="w-full bg-gray-700 text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-600 transition-all"
          >
            Back to Home
          </button>
        </div>

        {/* Help */}
        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>Need help? Contact our support team</p>
        </div>
      </div>
    </div>
  );
}

export default function AuthError() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}
