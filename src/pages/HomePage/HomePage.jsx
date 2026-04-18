import HomeWelcome from '@/pages/HomePage/HomeWelcome'
import HomeToolGrid from '@/pages/HomePage/HomeToolGrid'
import {Card, CardContent} from '@/components/ui/card'

export default function HomePage() {
  return (
    <div className="flex min-h-full items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-4xl space-y-10">
        <Card>
          <CardContent className="space-y-4 p-10">
            <HomeWelcome />
            <HomeToolGrid />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
