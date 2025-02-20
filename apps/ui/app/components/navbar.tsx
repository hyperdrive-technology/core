import { Badge } from "./ui/badge"
import { NavigationMenu, NavigationMenuItem, NavigationMenuLink, NavigationMenuList } from "./ui/navigation-menu"
import { Separator } from "./ui/separator"

interface NavbarProps {
  version: string
  isConnected: boolean
}

export function Navbar({ version, isConnected }: NavbarProps) {
  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-4">
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem className="flex items-center space-x-4">
              <NavigationMenuLink className="text-xl font-bold" href="/">
                Inrush
              </NavigationMenuLink>
              <Badge variant="secondary" className="text-xs">
                v{version}
              </Badge>
            </NavigationMenuItem>
            <Separator orientation="vertical" className="h-6! mx-3" />
            <NavigationMenuItem>
                <NavigationMenuLink
                  className="text-sm text-muted-foreground hover:text-primary"
                  href="/docs"
                >
                  Documentation
                </NavigationMenuLink>
              </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        <div className="ml-auto flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-muted-foreground">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <Separator orientation="vertical" className="h-6" />

        </div>
      </div>
    </div>
  )
}
