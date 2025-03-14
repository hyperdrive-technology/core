// app/routes/__root.tsx
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router';

import WebSocketProvider from '@/components/context/WebSocketContext';
import { ThemeProvider } from '@/components/ui/theme-provider';
import appCss from '@/styles/app.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Inrush IDE',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  component: RootDocument,
  errorComponent: ({ error }) => {
    console.error('Root error:', error);
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <h1 className="text-xl font-bold text-red-800 mb-2">
          Something went wrong
        </h1>
        <p className="text-red-600">{error?.message || 'Unknown error'}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Reload Page
        </button>
      </div>
    );
  },
});

function RootDocument() {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider defaultTheme="light" storageKey="hyperdrive-ui-theme">
          <WebSocketProvider>
            <Outlet />
          </WebSocketProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
