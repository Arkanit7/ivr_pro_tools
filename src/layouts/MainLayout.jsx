import Sidebar from '@/components/Sidebar'
import {Outlet} from 'react-router'

function MainLayout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-auto py-8">
        <Outlet />
      </main>
    </div>
  )
}

export default MainLayout
