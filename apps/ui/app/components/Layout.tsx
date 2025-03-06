import { ReactNode } from 'react';
import { Navbar } from './navbar';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar version="0.1.0" isConnected={true} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
