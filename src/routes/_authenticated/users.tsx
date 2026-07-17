import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '~/utils/supabase-client'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
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
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { FadeIn, StaggerContainer, StaggerItem } from '~/components/page-transition'
import { RoleGuard } from '~/components/role-guard'
import { getRoleLabel } from '~/hooks/useRole'
import toast from 'react-hot-toast'
import type { AppRole } from '~/lib/types'

export const Route = createFileRoute('/_authenticated/users')({
  component: UsersPage,
})

interface UserWithRoles {
  id: string
  email: string
  full_name: string | null
  roles: AppRole[]
  created_at: string
}

function UsersSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-20 bg-muted rounded animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
      ))}
    </div>
  )
}

function UsersPage() {
  const queryClient = useQueryClient()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<AppRole>('confirmation_agent')
  const [isInviting, setIsInviting] = useState(false)

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async (): Promise<UserWithRoles[]> => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')

      if (profilesError) {
        console.error('Failed to fetch profiles:', profilesError)
        return []
      }

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')

      if (rolesError) {
        console.error('Failed to fetch roles:', rolesError)
        return []
      }

      const rolesByUser = new Map<string, AppRole[]>()
      for (const r of roles || []) {
        const existing = rolesByUser.get(r.user_id) || []
        existing.push(r.role as AppRole)
        rolesByUser.set(r.user_id, existing)
      }

      // Also include auth users not in profiles
      const { data: authData } = await supabase.auth.admin.listUsers().catch(() => ({ data: { users: [] } }))

      const allUsers: UserWithRoles[] = []

      // From profiles
      for (const p of profiles || []) {
        allUsers.push({
          id: p.id,
          email: '',
          full_name: p.full_name,
          roles: rolesByUser.get(p.id) || [],
          created_at: p.created_at,
        })
      }

      // From auth users not in profiles
      for (const u of (authData?.users || [])) {
        if (!allUsers.find((au) => au.id === u.id)) {
          allUsers.push({
            id: u.id,
            email: u.email || '',
            full_name: u.user_metadata?.full_name || null,
            roles: rolesByUser.get(u.id) || [],
            created_at: u.created_at,
          })
        }
      }

      return allUsers
    },
    staleTime: 30_000,
  })

  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .upsert({ user_id: userId, role }, { onConflict: 'user_id,role' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('تمت إضافة الدور')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'فشل إضافة الدور')
    },
  })

  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('تم إزالة الدور')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'فشل إزالة الدور')
    },
  })

  const handleInvite = async () => {
    if (!inviteEmail) {
      toast.error('أدخل البريد الإلكتروني')
      return
    }
    setIsInviting(true)
    try {
      const { error } = await supabase.auth.admin.inviteUserByEmail(inviteEmail, {
        data: { role: inviteRole },
      })
      if (error) throw error
      toast.success(`تم إرسال الدعوة إلى ${inviteEmail}`)
      setInviteEmail('')
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل إرسال الدعوة')
    } finally {
      setIsInviting(false)
    }
  }

  return (
    <RoleGuard roles={['admin']}>
      <StaggerContainer className="space-y-4">
        <FadeIn>
          <div>
            <h2 className="text-lg font-semibold">إدارة المستخدمين</h2>
            <p className="text-sm text-muted-foreground">إضافة وتعديل أدوار المستخدمين</p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                دعوة مستخدم جديد
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col md:flex-row gap-3">
                <Input
                  type="email"
                  placeholder="البريد الإلكتروني"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1"
                  dir="ltr"
                />
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">مدير</SelectItem>
                    <SelectItem value="confirmation_agent">وكيل تأكيد</SelectItem>
                    <SelectItem value="shipping_manager">مدير شحن</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleInvite} disabled={isInviting || !inviteEmail}>
                  {isInviting ? (
                    <RefreshCw className="h-4 w-4 ml-1 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4 ml-1" />
                  )}
                  إرسال الدعوة
                </Button>
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.15}>
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
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
                      className="flex flex-col md:flex-row md:items-center justify-between py-3 border-b last:border-0 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">
                            {user.full_name || user.email || 'مستخدم'}
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
                              <Badge
                                key={role}
                                className="text-[10px] text-white"
                              >
                                {getRoleLabel(role)}
                                {user.roles.length > 1 && (
                                  <button
                                    className="mr-1 hover:text-red-200"
                                    onClick={() => removeRoleMutation.mutate({ userId: user.id, role })}
                                  >
                                    ×
                                  </button>
                                )}
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
                        {user.roles.length > 1 && (
                          <div className="flex gap-1">
                            {user.roles.map((role) => (
                              <Button
                                key={role}
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => removeRoleMutation.mutate({ userId: user.id, role })}
                                title={`إزالة ${getRoleLabel(role)}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.2}>
          <Card className="hover:shadow-md transition-shadow">
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
