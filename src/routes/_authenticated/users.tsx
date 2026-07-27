import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listUsers, createUser, addUserRole, removeUserRole, deleteUser } from '~/server/users'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { UserPlus, Trash2, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { RoleGuard } from '~/components/role-guard'
import { getRoleLabel } from '~/hooks/useRole'
import toast from 'react-hot-toast'
import type { AppRole } from '~/lib/types'

export const Route = createFileRoute('/_authenticated/users')({
  component: UsersPage,
})

function UsersSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-20 rounded-[15px] skeleton-shimmer" />
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

  const roleColors: Record<string, { bg: string; text: string }> = {
    admin: { bg: '#22c55e', text: '#fff' },
    confirmation_agent: { bg: '#f59e0b', text: '#fff' },
    shipping_manager: { bg: '#8b5cf6', text: '#fff' },
  }

  const permissions = [
    { role: 'مدير', color: '#22c55e', desc: 'وصول كامل — إدارة المستخدمين، الإعدادات، المنتجات، الإيرادات، التقارير، التوصيل، الطلبات، العملاء، مركز المكالمات' },
    { role: 'وكيل تأكيد', color: '#f59e0b', desc: 'الطلبات، العملاء، مركز المكالمات، لوحة التحكم — تعديل حالات الطلبات، تحديث جماعي' },
    { role: 'مدير شحن', color: '#8b5cf6', desc: 'الطلبات، التوصيل، لوحة التحكم — عرض الطلبات وتحديث حالات الشحن' },
  ]

  return (
    <RoleGuard roles={['admin']}>
      <div className="flex flex-col gap-5" style={{ animation: 'tfUp 0.4s ease both' }}>
        <div className="flex items-center justify-end">
          <Button
            onClick={() => setShowForm(!showForm)}
            className="h-10 rounded-[11px] font-semibold text-[13px]"
          >
            <UserPlus className="h-4 w-4 ml-1" />
            مستخدم جديد
          </Button>
        </div>

        {showForm && (
          <div className="dc-card p-5" style={{ borderColor: 'rgba(227,30,36,0.3)' }}>
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-[14.5px] font-extrabold">إنشاء مستخدم جديد</h3>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-medium text-muted-foreground">الاسم الكامل</Label>
                  <Input
                    placeholder="محمد أحمد"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="h-10 rounded-[11px] text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-medium text-muted-foreground">البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    placeholder="user@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    dir="ltr"
                    className="h-10 rounded-[11px] text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-medium text-muted-foreground">كلمة المرور</Label>
                  <Input
                    type="password"
                    placeholder="6 أحرف على الأقل"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    dir="ltr"
                    className="h-10 rounded-[11px] text-[13px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-medium text-muted-foreground">الدور</Label>
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                    <SelectTrigger className="h-10 rounded-[11px]">
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
                <Button variant="ghost" onClick={() => setShowForm(false)} className="text-[13px]">
                  إلغاء
                </Button>
                <Button
                  onClick={() => createUserMutation.mutate()}
                  disabled={createUserMutation.isPending || !newEmail || !newPassword}
                  className="h-9 rounded-[11px] font-bold text-[12px]"
                >
                  {createUserMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 ml-1 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4 ml-1" />
                  )}
                  إنشاء المستخدم
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="dc-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-[14.5px] font-extrabold">المستخدمون ({users.length})</h3>
          </div>
          {isLoading ? (
            <UsersSkeleton />
          ) : users.length === 0 ? (
            <p className="text-[13px] text-muted-foreground text-center py-8">لا يوجد مستخدمون</p>
          ) : (
            <div className="flex flex-col">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col md:flex-row md:items-center justify-between py-3 border-b border-divider last:border-0 table-row-hover"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-[13px]">{user.full_name || 'مستخدم'}</p>
                      {user.email && (
                        <span className="text-[11px] text-muted-foreground font-mono" dir="ltr">
                          {user.email}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {user.roles.length > 0 ? (
                        user.roles.map((role) => {
                          const colors = roleColors[role] || { bg: '#6b7280', text: '#fff' }
                          return (
                            <span
                              key={role}
                              className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold"
                              style={{ background: colors.bg, color: colors.text }}
                            >
                              {getRoleLabel(role)}
                              <button
                                className="mr-1 hover:opacity-70"
                                onClick={() => removeRoleMutation.mutate({ userId: user.id, role })}
                                title={`إزالة ${getRoleLabel(role)}`}
                              >
                                ×
                              </button>
                            </span>
                          )
                        })
                      ) : (
                        <span className="inline-flex items-center h-5 px-2 rounded-full border border-divider text-[10px] font-bold text-muted-foreground">
                          بدون دور
                        </span>
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
                      <SelectTrigger className="w-[140px] h-8 rounded-[11px] text-[11px]">
                        <SelectValue placeholder="إضافة دور" />
                      </SelectTrigger>
                      <SelectContent>
                        {(['admin', 'confirmation_agent', 'shipping_manager'] as AppRole[])
                          .filter((r) => !user.roles.includes(r))
                          .map((r) => (
                            <SelectItem key={r} value={r} className="text-[11px]">
                              {getRoleLabel(r)}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <button
                      className="flex items-center justify-center h-8 w-8 rounded-[9px] text-destructive hover:bg-destructive/10 transition-colors"
                      onClick={() => {
                        if (confirm(`هل أنت متأكد من حذف ${user.email || user.full_name}؟`)) {
                          deleteUserMutation.mutate({ userId: user.id })
                        }
                      }}
                      title="حذف المستخدم"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dc-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-[14.5px] font-extrabold">ملخص الأدوار والصلاحيات</h3>
          </div>
          <div className="flex flex-col gap-2.5">
            {permissions.map((perm) => (
              <div
                key={perm.role}
                className="flex items-start gap-3 p-3 rounded-[11px]"
                style={{ background: `${perm.color}0a` }}
              >
                <span
                  className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold shrink-0"
                  style={{ background: perm.color, color: '#fff' }}
                >
                  {perm.role}
                </span>
                <div className="text-[11.5px] text-muted-foreground">{perm.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </RoleGuard>
  )
}
