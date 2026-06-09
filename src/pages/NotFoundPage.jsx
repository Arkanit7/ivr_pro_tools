import {Link} from 'react-router'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import {Home, AlertTriangle} from 'lucide-react'
import {navigationRoutes} from '@/router/navigation'

function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">
            Сторінку не знайдено
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            Сторінка, яку ви шукаєте, не існує або була переміщена.
          </p>
          <Button asChild className="w-full">
            <Link to={navigationRoutes.home}>
              <Home className="mr-2 h-4 w-4" />
              На головну
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default NotFoundPage
