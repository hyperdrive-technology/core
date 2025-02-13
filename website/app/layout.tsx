import { tree } from '@/app/source';
import { DocsLayout } from '@fumadocs/ui';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full`}>
        <DocsLayout tree={tree} nav={{ title: 'Inrush Docs' }}>
          {children}
        </DocsLayout>
      </body>
    </html>
  );
}
