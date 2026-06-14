import {Link} from 'react-router'
import {Button} from '@/components/ui/button'
import {navItems} from '@/router/navigation'

export default function HomeToolGrid() {
  return (
    <div className="grid gap-2.5 sm:grid-cols-3">
      {navItems.map(({to, icon: Icon, label}) => (
        <Button key={to} asChild className="w-full justify-start gap-2">
          <Link to={to}>
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        </Button>
      ))}
    </div>
  )
}
