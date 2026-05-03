'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, Plus, Phone, Clock, X, Loader2, Edit2, Trash2, ClipboardList, UserCheck, AlertCircle } from 'lucide-react'
import AdminBottomNav from '@/components/admin/AdminBottomNav'
import { cn } from '@/lib/utils'
import type { Employee, ShiftType, EmployeeTask } from '@/types'

const DEMO: Employee[] = []

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>(DEMO)
  const [unlinkedUsers, setUnlinkedUsers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'day' | 'night'>('all')
  const [modal, setModal] = useState(false)
  const [taskModal, setTaskModal] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [selectedForTask, setSelectedForTask] = useState<Employee | null>(null)
  const [saving, setSaving] = useState(false)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    const fetchEmployees = async () => {
      const { data, error } = await supabase.from('employees').select('*')
      if (data && !error) {
        setEmployees(data as Employee[])
        setIsLive(true)
      } else {
        setIsLive(false)
      }
    }

    const fetchUsers = async () => {
      const { data } = await supabase.from('users').select('*').eq('role', 'employee')
      if (data) {
        setUnlinkedUsers(data)
      }
    }

    fetchEmployees()
    fetchUsers()

    const subEmp = supabase.channel('admin_employees')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => {
        fetchEmployees()
      })
      .subscribe()
    
    const subUsers = supabase.channel('admin_users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchUsers()
      })
      .subscribe()

    return () => { supabase.removeChannel(subEmp); supabase.removeChannel(subUsers) }
  }, [])

  // Find users who have registered but aren't in the 'employees' collection
  const pendingRegistrations = unlinkedUsers.filter(u =>
    !employees.some(e => e.email === u.email)
  )

  const filtered = employees.filter(e => {
    const matchQ = e.name.toLowerCase().includes(search.toLowerCase()) || e.role.toLowerCase().includes(search.toLowerCase())
    return matchQ && (filter === 'all' || e.shift === filter)
  })

  async function toggleActive(emp: Employee) {
    const updated = { isActive: !emp.isActive }
    try {
      await supabase.from('employees').update(updated).eq('id', emp.id)
    } catch { }
  }

  async function del(id: string) {
    if (!confirm('Remove this employee?')) return
    try { await supabase.from('employees').delete().eq('id', id) } catch { }
  }

  async function save(data: Partial<Employee>) {
    setSaving(true)
    try {
      if (editing) {
        const isNew = !employees.some(e => e.id === editing.id && e.joinedAt)
        await supabase.from('employees').upsert({
          id: editing.id,
          ...data,
          ...(isNew ? { joinedAt: new Date().toISOString() } : {}),
          isActive: true
        })
      } else {
        await supabase.from('employees').insert([{
          ...data,
          joinedAt: new Date().toISOString(),
          isActive: true
        }])
      }
    } catch (e) {
      console.error("Save error:", e)
    }
    setSaving(false); setModal(false); setEditing(null)
  }

  return (
    <div className="has-bottom-nav min-h-screen bg-gray-50">
      <div className="admin-header">
        <div>
          <h1 className="text-xl font-extrabold text-text-primary">Employees</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className={cn('w-2 h-2 rounded-full', isLive ? 'bg-green-400' : 'bg-gray-300')} />
            <p className="text-text-muted text-xs">{isLive ? 'Live sync' : 'Demo data'}</p>
          </div>
        </div>
        <button onClick={() => { setEditing(null); setModal(true) }}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-2xl font-bold text-sm shadow-primary">
          <Plus size={16} /> Add Staff
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-3 px-5 pt-3 mb-3">
        {[{ l: 'Total', v: employees.length, c: 'text-text-primary' }, { l: 'Day', v: employees.filter(e => e.shift === 'day').length, c: 'text-primary' }, { l: 'Night', v: employees.filter(e => e.shift === 'night').length, c: 'text-blue-500' }, { l: 'Inactive', v: employees.filter(e => !e.isActive).length, c: 'text-red-400' }].map(({ l, v, c }) => (
          <div key={l} className="flex-1 bg-white rounded-2xl shadow-card py-3 px-2 text-center">
            <p className={cn('text-xl font-extrabold', c)}>{v}</p>
            <p className="text-text-muted text-[10px] font-semibold mt-0.5">{l}</p>
          </div>
        ))}
      </div>

      {/* Pending Registrations Alert */}
      {pendingRegistrations.length > 0 && (
        <div className="px-5 mb-4">
          <div className="bg-amber-50 border border-amber-100 rounded-3xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center">
                <UserCheck size={18} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-black text-amber-900 leading-tight">{pendingRegistrations.length} New Registrations</p>
                <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wide">Pending Shift & Wage Setup</p>
              </div>
            </div>
            <div className="space-y-2">
              {pendingRegistrations.map(u => (
                <div key={u.uid} className="bg-white/80 rounded-2xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-900">{u.name}</p>
                    <p className="text-[10px] text-gray-400 font-medium">{u.email}</p>
                  </div>
                  <button onClick={() => { setEditing({ id: u.uid, name: u.name, email: u.email, phone: u.phone || '', role: 'Staff', shift: 'day', dailyWage: 1200, joinedAt: new Date(), isActive: true }); setModal(true) }}
                    className="bg-amber-500 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">
                    Link Staff
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="px-5">
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workers..."
            className="input-field pl-9 py-3 text-sm" />
        </div>
        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-1">
          {(['all', 'day', 'night'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0',
                filter === f ? 'bg-primary text-white shadow-primary' : 'bg-white text-text-secondary shadow-card')}>
              {f === 'all' ? 'All Shifts' : f.charAt(0).toUpperCase() + f.slice(1) + ' Shift'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 pb-4 space-y-3">
        {filtered.map(emp => (
          <div key={emp.id} className="bg-white rounded-3xl shadow-card p-4">
            <div className="flex items-center gap-3">
              <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-lg font-extrabold',
                emp.isActive ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400')}>
                {emp.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-text-primary font-bold text-sm truncate">{emp.name}</p>
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0',
                    emp.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600')}>
                    {emp.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-text-muted text-xs">{emp.role}</p>
              </div>
              <button onClick={() => toggleActive(emp)}
                className={cn('w-10 h-6 rounded-full relative transition-colors shrink-0',
                  emp.isActive ? 'bg-primary' : 'bg-gray-200')}>
                <div className={cn('w-4 h-4 bg-white rounded-full absolute top-1 shadow-sm transition-transform',
                  emp.isActive ? 'translate-x-5' : 'translate-x-1')} />
              </button>
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <Phone size={11} className="text-gray-400" />
                <span className="text-text-muted text-xs">{emp.phone}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={11} className="text-gray-400" />
                <span className={cn('text-xs font-semibold', emp.shift === 'day' ? 'text-primary' : 'text-blue-500')}>
                  {emp.shift === 'day' ? '4:00 AM – 11:30 AM' : '11:30 AM – 8:00 PM'}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <span className="text-text-muted text-xs">Daily: <span className="text-text-primary font-bold">Rs.{emp.dailyWage}</span></span>
              <div className="flex gap-3">
                <button onClick={() => { setSelectedForTask(emp); setTaskModal(true) }} className="flex items-center gap-1 text-xs text-blue-500 font-bold"><ClipboardList size={12} /> Tasks</button>
                <button onClick={() => { setEditing(emp); setModal(true) }} className="flex items-center gap-1 text-xs text-primary font-bold"><Edit2 size={12} /> Edit</button>
                <button onClick={() => del(emp.id)} className="flex items-center gap-1 text-xs text-red-500 font-bold"><Trash2 size={12} /> Remove</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modal && <EmpModal emp={editing} onSave={save} onClose={() => { setModal(false); setEditing(null) }} loading={saving} />}
      {taskModal && selectedForTask && (
        <TaskModal emp={selectedForTask} onClose={() => { setTaskModal(false); setSelectedForTask(null) }} />
      )}
      <AdminBottomNav />
    </div>
  )
}

function EmpModal({ emp, onSave, onClose, loading }: { emp: Employee | null; onSave: (d: Partial<Employee>) => void; onClose: () => void; loading: boolean }) {
  const [name, setName] = useState(emp?.name ?? '')
  const [phone, setPhone] = useState(emp?.phone ?? '')
  const [email, setEmail] = useState(emp?.email ?? '')
  const [role, setRole] = useState(emp?.role ?? '')
  const [shift, setShift] = useState<ShiftType>(emp?.shift ?? 'day')
  const [wage, setWage] = useState(emp?.dailyWage?.toString() ?? '')
  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-end justify-center animate-in fade-in duration-300"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-mobile rounded-t-[40px] flex flex-col max-h-[92vh] shadow-2xl animate-in slide-in-from-bottom duration-500 overflow-hidden">
        {/* Fixed header */}
        <div className="flex items-center justify-between px-6 pt-7 pb-4 border-b border-gray-50 shrink-0">
          <h2 className="font-extrabold text-text-primary text-lg">{emp ? 'Edit Employee' : 'Add New Staff'}</h2>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center transition-transform active:scale-90">
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 scrollbar-hide">
          <div className="space-y-4">
            {[{ l: 'Full Name', v: name, s: setName, p: 'Kumari Perera' }, { l: 'Phone', v: phone, s: setPhone, p: '07X-XXX-XXXX' }, { l: 'Email', v: email, s: setEmail, p: 'name@gmail.com' }, { l: 'Role', v: role, s: setRole, p: 'Cook / Cashier / Server' }, { l: 'Daily Wage (Rs)', v: wage, s: setWage, p: '1200' }].map(({ l, v, s, p }) => (
              <div key={l}>
                <label className="block text-sm font-bold text-text-primary mb-1.5">{l}</label>
                <input value={v} onChange={e => s(e.target.value)} placeholder={p} className="input-field py-4 bg-gray-50 border-transparent focus:bg-white focus:border-primary transition-all" />
              </div>
            ))}
            <div className="pb-4">
              <label className="block text-sm font-bold text-text-primary mb-2">Shift</label>
              <div className="grid grid-cols-2 gap-3">
                {(['day', 'night'] as ShiftType[]).map(s => (
                  <button key={s} onClick={() => setShift(s)}
                    className={cn('py-4 rounded-2xl border-2 text-sm font-bold capitalize transition-all',
                      shift === s ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100 text-text-secondary')}>
                    {s} Shift
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Fixed footer buttons */}
        <div className="flex gap-3 px-6 pt-4 pb-12 border-t border-gray-50 bg-white shrink-0">
          <button onClick={onClose} className="btn-outline flex-1 py-4 font-black uppercase text-[11px] tracking-widest text-gray-400 border-gray-100">Cancel</button>
          <button onClick={() => onSave({ name, phone, email, role, shift, dailyWage: +wage })}
            disabled={loading || !name} className="btn-primary flex-1 py-4 font-black uppercase text-[11px] tracking-widest gap-2">
            {loading ? <><Loader2 size={16} className="animate-spin" />Saving...</> : 'Save Staff'}
          </button>
        </div>
      </div>
    </div>
  )
}
function TaskModal({ emp, onClose }: { emp: Employee; onClose: () => void }) {
  const [task, setTask] = useState('')
  const [tasks, setTasks] = useState<EmployeeTask[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchTasks = async () => {
      const { data } = await supabase.from('employee_tasks').select('*').eq('employeeId', emp.id).order('createdAt', { ascending: false })
      if (data) setTasks(data as EmployeeTask[])
    }

    fetchTasks()
    
    const sub = supabase.channel(`tasks_${emp.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_tasks', filter: `employeeId=eq.${emp.id}` }, () => {
        fetchTasks()
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [emp.id])

  async function assignTask() {
    if (!task.trim()) return
    setLoading(true)
    try {
      await supabase.from('employee_tasks').insert([{
        employeeId: emp.id,
        employeeName: emp.name,
        taskTitle: task,
        status: 'pending',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      }])
      setTask('')
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function deleteTask(id: string) {
    try { await supabase.from('employee_tasks').delete().eq('id', id) } catch (e) { console.error(e) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[80vh] animate-in zoom-in duration-300">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-gray-900 tracking-tight">Tasks: {emp.name.split(' ')[0]}</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Assign Daily Duties</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400"><X size={16} /></button>
        </div>

        <div className="p-6 pb-2">
          <div className="flex gap-2">
            <input value={task} onChange={e => setTask(e.target.value)}
              placeholder="Enter task description..."
              className="flex-1 input-field py-3.5 text-xs bg-gray-50 border-transparent focus:bg-white focus:border-primary transition-all" />
            <button onClick={assignTask} disabled={loading || !task.trim()}
              className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-primary active:scale-90 transition-all">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={20} />}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pt-2 scrollbar-hide space-y-3">
          {tasks.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-gray-300 text-xs font-bold">No tasks assigned yet</p>
            </div>
          ) : (
            tasks.map(t => (
              <div key={t.id} className="bg-gray-50 rounded-2xl p-4 flex items-start gap-3 border border-gray-100">
                <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', t.status === 'completed' ? 'bg-green-500' : 'bg-amber-500')} />
                <div className="flex-1">
                  <p className={cn('text-xs font-bold leading-tight', t.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900')}>
                    {t.taskTitle}
                  </p>
                  <p className="text-[10px] text-gray-400 font-medium mt-1 uppercase tracking-tighter">
                    {t.status} · {t.date}
                  </p>
                </div>
                <button onClick={() => deleteTask(t.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
