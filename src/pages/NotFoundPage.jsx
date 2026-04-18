import Container from '@/components/Container'
import {navigationRoutes} from '@/router/navigation'
import {Link} from 'react-router'

function NotFoundPage() {
  return (
    <Container className="grid min-h-full justify-items-center gap-8">
      <h1 className="text-warning-content text-center">
        Oops, that page doesn't exist...
      </h1>
      <Link className="btn btn-primary" to={navigationRoutes.home}>
        Back to the home page
      </Link>
    </Container>
  )
}

export default NotFoundPage
