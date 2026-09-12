import Link from 'next/link';

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-playfair font-bold text-gray-900 mb-4">
          Forgot Password
        </h1>
        <p className="text-gray-600 mb-8">
          Password recovery coming soon...
        </p>
        <Link
          href="/login"
          className="inline-block px-6 py-3 bg-ruhiz-teal text-white font-medium rounded-full hover:bg-opacity-90 transition-colors"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}
