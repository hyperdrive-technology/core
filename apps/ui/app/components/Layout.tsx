import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider } from './ui/sidebar';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-screen bg-background flex w-screen ">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
