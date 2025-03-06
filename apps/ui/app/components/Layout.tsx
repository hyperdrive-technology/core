import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider } from './ui/sidebar';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen bg-background flex flex-1 w-screen">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
