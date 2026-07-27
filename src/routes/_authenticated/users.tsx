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
import { UserPlus, Trash2, RefreshCw } from 'lucide-react'
import { RoleGuard } from '~/components/role-guard'
import { getRoleLabel } from '~/hooks/useRole'
import toast from 'react-hot-toast'
import type { AppRole } from '~/lib/types'

export const Route = createFileRoute('/_authenticated/users')({
  component: UsersPage,
})

function getInitials(name: string | null) {
  if (!name) return '??'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return parts[0][0] + parts[1][0]
  return parts[0]?.slice(0, 2) || '??'
}

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

  return (
    <RoleGuard roles={['admin']}>
      <div className="flex flex-col gap-5" style={{ animation: 'tfUp 0.4s ease both' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] text-muted-foreground">المستخدمون</span>
            <span className="inline-flex items-center h-5 px-2 rounded-full bg-muted text-[10px] font-bold text-muted-foreground font-mono">
              {users.length}
            </span>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="h-10 rounded-[11px] font-bold text-[13px]"
          >
            <UserPlus className="h-4 w-4 ml-1" />
            إضافة مستخدم
          </Button>
        </div>

        {showForm && (
          <div className="dc-card p-5" style={{ borderColor: 'rgba(227,30,36,0.3)' }}>
            <h3 className="text-[14.5px] font-extrabold mb-4">إنشاء مستخدم جديد</h3>
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
                  إنشاء
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="dc-card overflow-hidden">
          <div
            className="flex items-center text-[11.5px] font-bold text-muted-foreground"
            style={{ background: 'var(--color-table-header)', borderBottom: '1px solid var(--color-table-border)' }}
          >
            <div className="px-4 py-2.5 flex-1 min-w-[160px]">المستخدم</div>
            <div className="px-3 py-2.5 w-[180px] shrink-0 hidden md:block">البريد</div>
            <div className="px-3 py-2.5 w-[100px] shrink-0 text-center">الدور</div>
            <div className="px-3 py-2.5 w-20 shrink-0 text-center">الحالة</div>
            <div className="px-3 py-2.5 w-16 shrink-0" />
          </div>
          {isLoading ? (
            <UsersSkeleton />
          ) : users.length === 0 ? (
            <p className="text-[13px] text-muted-foreground text-center py-8">لا يوجد مستخدمون</p>
          ) : (
            <div className="overflow-auto">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center text-[13px] border-b border-divider last:border-b-0 table-row-hover"
                >
                  <div className="px-4 py-2.5 flex-1 min-w-[160px]">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-white text-[12px]"
                        style={{ background: 'linear-gradient(135deg, #e31e24, #7d1622)' }}
                      >
                        {getInitials(user.full_name)}
                      </div>
                      <span className="font-semibold truncate">{user.full_name || 'مستخدم'}</span>
                    </div>
                  </div>
                  <div className="px-3 py-2.5 w-[180px] shrink-0 hidden md:block">
                    <span className="text-[12px] text-muted-foreground font-mono truncate block" dir="ltr">
                      {user.email || '—'}
                    </span>
                  </div>
                  <div className="px-3 py-2.5 w-[100px] shrink-0 text-center">
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                      {user.roles.length > 0 ? (
                        user.roles.map((role) => {
                          const colors = roleColors[role] || { bg: '#6b7280', text: '#fff' }
                          return (
                            <span
                              key={role}
                              className="inline-flex items-center h-5 px-2 rounded-full text-[9px] font-bold cursor-pointer hover:opacity-80"
                              style={{ background: colors.bg, color: colors.text }}
                              onClick={() => removeRoleMutation.mutate({ userId: user.id, role })}
                              title={`إزالة ${getRoleLabel(role)}`}
                            >
                              {getRoleLabel(role)}
                            </span>
                          )
                        })
                      ) : (
                        <span className="inline-flex items-center h-5 px-2 rounded-full border border-divider text-[9px] font-bold text-muted-foreground">
                          بدون دور
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="px-3 py-2.5 w-20 shrink-0 text-center">
                    <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-[var(--status-delivered)]/15 text-[var(--status-delivered)] text-[9px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-delivered)]" />
                      نشط
                    </span>
                  </div>
                  <div className="px-3 py-2.5 w-16 shrink-0 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Select
                        value=""
                        onValueChange={(v) => {
                          if (v && !user.roles.includes(v as AppRole)) {
                            addRoleMutation.mutate({ userId: user.id, role: v as AppRole })
                          }
                        }}
                      >
                        <SelectTrigger className="w-[100px] h-7 rounded-[9px] text-[10px] border-0 bg-transparent">
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
                        className="flex items-center justify-center h-7 w-7 rounded-[9px] text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={() => {
                          if (confirm(`هل أنت متأكد من حذف ${user.email || user.full_name}؟`)) {
                            deleteUserMutation.mutate({ userId: user.id })
                          }
                        }}
                        title="حذف المستخدم"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </RoleGuard>
  )
}
