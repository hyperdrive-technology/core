import { Link } from '@tanstack/react-router';
import {
  Code,
  Home,
  LayoutDashboard,
  Moon,
  Search,
  Settings,
  Sun,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { useTheme } from '@/components/ui/theme-provider';
import { cn } from '@/lib/utils';

// Menu items
const mainItems = [
  {
    title: 'Home',
    url: '/',
    icon: Home,
  },
  {
    title: 'Editor',
    url: '/editor',
    icon: Code,
  },
  {
    title: 'Logic',
    url: '/logic',
    icon: LayoutDashboard,
  },
];

const utilityItems = [
  {
    title: 'Search',
    url: '#',
    icon: Search,
  },
  {
    title: 'Settings',
    url: '#',
    icon: Settings,
  },
];

export function AppSidebar() {
  const { state } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="py-2 px-2 items-center justify-center">
        <div
          className={cn(
            'flex items-center justify-between w-full',
            state === 'collapsed' && 'justify-center',
          )}
        >
          {state !== 'collapsed' && (
            <div className="flex items-center gap-2 px-2">
              <span className="text-xl font-bold group-data-[collapsible=icon]:data-[state=closed]:hidden">
                Inrush
              </span>
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded group-data-[collapsible=icon]:data-[state=closed]:hidden">
                v0.1.0
              </span>
            </div>
          )}
          <SidebarTrigger />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Utilities</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {utilityItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <div className="flex items-center">
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { state } = useSidebar();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      className="w-full rounded-md justify-start px-2"
    >
      <span className="sr-only">Toggle theme</span>
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      {state !== 'collapsed' && (
        <span className="text-sm font-normal">
          {theme === 'light' ? 'Dark' : 'Light'}
        </span>
      )}
    </Button>
  );
}
