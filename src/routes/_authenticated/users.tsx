import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listUsers, createUser, addUserRole, removeUserRole, deleteUser } from '~/server/users'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import { Label } from '~/components/ui/label'
import { Skeleton } from '~/components/ui/skeleton'
import { Separator } from '~/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import {
  Shield,
  UserPlus,
  Trash2,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { FadeIn, StaggerContainer } from '~/components/page-transition'
import { RoleGuard } from '~/components/role-guard'
import { getRoleLabel } from '~/hooks/useRole'
import toast from 'react-hot-toast'
import type { AppRole } from '~/lib/types'

export const Route = createFileRoute('/_authenticated/users')({
  component: UsersPage,
})

function UsersSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-20 skeleton-shimmer rounded-lg" />
      ))}
    </div>
  )
}

function UsersPage() {
  const queryClient = useQueryClient()

  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<AppRole>('confirmation_agent')
  const [showForm, setShowForm] = useState(false)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => listUsers(),
    staleTime: 30_000,
  })

  const createUserMutation = useMutation({
    mutationFn: async () => {
      const result = await createUser({
        data: { email: newEmail, password: newPassword, fullName: newName, role: newRole },
      })
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(`تم إنشاء المستخدم ${newEmail}`)
      setNewEmail('')
      setNewPassword('')
      setNewName('')
      setShowForm(false)
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'فشل إنشاء المستخدم')
    },
  })

  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const result = await addUserRole({ data: { userId, role } })
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('تمت إضافة الدور')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'فشل')
    },
  })

  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const result = await removeUserRole({ data: { userId, role } })
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('تم إزالة الدور')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'فشل')
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      const result = await deleteUser({ data: { userId } })
      if (!result.ok) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('تم حذف المستخدم')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'فشل الحذف')
    },
  })

  return (
    <RoleGuard roles={['admin']}>
      <StaggerContainer className="space-y-4">
        <FadeIn>
          <div className="flex items-center justify-end">
            <Button onClick={() => setShowForm(!showForm)}>
              <UserPlus className="h-4 w-4 ml-1" />
              مستخدم جديد
            </Button>
          </div>
        </FadeIn>

        {showForm && (
          <FadeIn delay={0.05}>
            <Card className="card-hover border-primary/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  إنشاء مستخدم جديد
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الاسم الكامل</Label>
                    <Input
                      placeholder="محمد أحمد"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>البريد الإلكتروني</Label>
                    <Input
                      type="email"
                      placeholder="user@example.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>كلمة المرور</Label>
                    <Input
                      type="password"
                      placeholder="6 أحرف على الأقل"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الدور</Label>
                    <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">مدير</SelectItem>
                        <SelectItem value="confirmation_agent">وكيل تأكيد</SelectItem>
                        <SelectItem value="shipping_manager">مدير شحن</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <Button variant="ghost" onClick={() => setShowForm(false)}>
                    إلغاء
                  </Button>
                  <Button
                    onClick={() => createUserMutation.mutate()}
                    disabled={createUserMutation.isPending || !newEmail || !newPassword}
                  >
                    {createUserMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 ml-1 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4 ml-1" />
                    )}
                    إنشاء المستخدم
                  </Button>
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        )}

        <FadeIn delay={0.1}>
          <Card className="card-hover">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                المستخدمون ({users.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <UsersSkeleton />
              ) : users.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">لا يوجد مستخدمون</p>
              ) : (
                <div className="space-y-2">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex flex-col md:flex-row md:items-center justify-between py-3 border-b last:border-0 table-row-hover -mx-2 px-2 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">
                            {user.full_name || 'مستخدم'}
                          </p>
                          {user.email && (
                            <span className="text-xs text-muted-foreground font-mono" dir="ltr">
                              {user.email}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {user.roles.length > 0 ? (
                            user.roles.map((role) => (
                              <Badge key={role} className="text-[10px] text-white">
                                {getRoleLabel(role)}
                                <button
                                  className="mr-1 hover:text-red-200"
                                  onClick={() => removeRoleMutation.mutate({ userId: user.id, role })}
                                  title={`إزالة ${getRoleLabel(role)}`}
                                >
                                  ×
                                </button>
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="outline" className="text-[10px]">بدون دور</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 md:mt-0">
                        <Select
                          value=""
                          onValueChange={(v) => {
                            if (v && !user.roles.includes(v as AppRole)) {
                              addRoleMutation.mutate({ userId: user.id, role: v as AppRole })
                            }
                          }}
                        >
                          <SelectTrigger className="w-[140px] h-8 text-xs">
                            <SelectValue placeholder="إضافة دور" />
                          </SelectTrigger>
                          <SelectContent>
                            {(['admin', 'confirmation_agent', 'shipping_manager'] as AppRole[])
                              .filter((r) => !user.roles.includes(r))
                              .map((r) => (
                                <SelectItem key={r} value={r} className="text-xs">
                                  {getRoleLabel(r)}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm(`هل أنت متأكد من حذف ${user.email || user.full_name}؟`)) {
                              deleteUserMutation.mutate({ userId: user.id })
                            }
                          }}
                          title="حذف المستخدم"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.15}>
          <Card className="card-hover">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                ملخص الأدوار والصلاحيات
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--status-delivered)]/5">
                  <Badge className="text-[10px] text-white shrink-0">مدير</Badge>
                  <div className="text-xs text-muted-foreground">
                    وصول كامل — إدارة المستخدمين، الإعدادات، المنتجات، الإيرادات، التقارير، التوصيل، الطلبات، العملاء، مركز المكالمات
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--status-processing)]/5">
                  <Badge className="text-[10px] text-white shrink-0">وكيل تأكيد</Badge>
                  <div className="text-xs text-muted-foreground">
                    الطلبات، العملاء، مركز المكالمات، لوحة التحكم — تعديل حالات الطلبات، تحديث جماعي
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--status-shipped)]/5">
                  <Badge className="text-[10px] text-white shrink-0">مدير شحن</Badge>
                  <div className="text-xs text-muted-foreground">
                    الطلبات، التوصيل، لوحة التحكم — عرض الطلبات وتحديث حالات الشحن
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </StaggerContainer>
    </RoleGuard>
  )
}
