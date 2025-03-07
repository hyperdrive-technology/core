import { Link } from '@tanstack/react-router';

export function ErrorBoundary({ error }: { error: Error }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="text-center p-8 max-w-md">
        <h1 className="text-3xl font-bold mb-4">Something went wrong</h1>
        <div className="p-4 bg-red-50 border border-red-200 rounded-md mb-6">
          <p className="text-red-600 font-medium">
            {error?.message || 'An unknown error occurred'}
          </p>
        </div>
        <div className="space-y-4">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors mr-4"
          >
            Reload Page
          </button>
          <Link
            to="/"
            className="px-4 py-2 border border-primary text-primary rounded-md hover:bg-primary/10 transition-colors"
          >
            Go Back Home
          </Link>
        </div>
      </div>
    </div>
  );
}
