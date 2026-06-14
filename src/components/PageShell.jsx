import {cn} from '@/lib/utils'

export function PageShell({children, className}) {
  return (
    <div className={cn('flex min-h-full items-center justify-center p-6', className)}>
      {children}
    </div>
  )
}
