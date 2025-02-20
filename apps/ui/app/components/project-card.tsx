import { ArrowRight } from "lucide-react"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"

interface ProjectCardProps {
  name: string
  description: string
  lastOpened: string
  onClick: () => void
}

export function ProjectCard({ name, description, lastOpened, onClick }: ProjectCardProps) {
  return (
    <Card className="hover:bg-accent/50 cursor-pointer transition-colors" onClick={onClick}>
      <CardHeader>
        <CardTitle className="text-lg">{name}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Last opened: {lastOpened}
          </span>
          <Button variant="ghost" size="sm">
            Open <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
