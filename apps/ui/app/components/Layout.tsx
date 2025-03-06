import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, SidebarTrigger } from './ui/sidebar';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen bg-background flex flex-1">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <main className="flex-1 p-4">
            <SidebarTrigger className="lg:hidden mb-4" />
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
