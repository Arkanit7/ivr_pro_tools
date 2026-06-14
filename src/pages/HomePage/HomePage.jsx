import HomeWelcome from '@/pages/HomePage/HomeWelcome'
import HomeToolGrid from '@/pages/HomePage/HomeToolGrid'
import {Card, CardContent} from '@/components/ui/card'
import {PageShell} from '@/components/PageShell'

export default function HomePage() {
  return (
    <PageShell className="py-10">
      <div className="w-full max-w-4xl">
        <Card>
          <CardContent className="space-y-4 p-10">
            <HomeWelcome />
            <HomeToolGrid />
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}
