import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-8">Mobile Worship</h1>
      <p className="text-xl text-gray-600 dark:text-gray-400 mb-12 text-center max-w-2xl">
        Display worship lyrics beautifully on any screen. Control from any device.
      </p>
      <div className="flex gap-4">
        <Link
          to="/login"
          className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
        >
          Sign In
        </Link>
        <Link
          to="/signup"
          className="px-6 py-3 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-950 transition"
        >
          Get Started
        </Link>
      </div>
    </main>
  );
}
