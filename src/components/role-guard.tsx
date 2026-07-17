import type { ReactNode } from 'react'
import { useRole } from '~/hooks/useRole'
import type { AppRole } from '~/lib/types'
import { Card, CardContent } from '~/components/ui/card'
import { ShieldOff } from 'lucide-react'

interface RoleGuardProps {
  children: ReactNode
  roles: AppRole[]
  fallback?: ReactNode
}

export function RoleGuard({ children, roles, fallback }: RoleGuardProps) {
  const { roles: userRoles, isLoading } = useRole()

  if (isLoading) return null

  const hasAccess = roles.some((r) => userRoles.includes(r))

  if (!hasAccess) {
    if (fallback) return <>{fallback}</>
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <ShieldOff className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-medium">غير مصرح</p>
          <p className="text-sm text-muted-foreground mt-1">
            ليس لديك صلاحية للوصول إلى هذه الصفحة
          </p>
        </CardContent>
      </Card>
    )
  }

  return <>{children}</>
}

interface RoleHideProps {
  children: ReactNode
  roles: AppRole[]
}

export function RoleHide({ children, roles }: RoleHideProps) {
  const { roles: userRoles, isLoading } = useRole()

  if (isLoading) return null

  const hasAccess = roles.some((r) => userRoles.includes(r))

  if (!hasAccess) return null

  return <>{children}</>
}
