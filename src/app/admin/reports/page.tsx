'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
   BarChart3, TrendingUp, Users, Calendar,
   ArrowLeft, Download, Filter, Search,
   ChevronRight, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import { cn, formatPrice, formatTime } from '@/lib/utils'
import type { Order, AttendanceRecord, InventoryItem } from '@/types'
import {
   BarChart, Bar, XAxis, YAxis, CartesianGrid,
   Tooltip, ResponsiveContainer, LineChart, Line,
   AreaChart, Area
} from 'recharts'
import AdminBottomNav from '@/components/admin/AdminBottomNav'

export default function AdminReportsPage() {
   const [orders, setOrders] = useState<Order[]>([])
   const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
   const [inventory, setInventory] = useState<InventoryItem[]>([])
   const [loading, setLoading] = useState(true)
   const [activeTab, setActiveTab] = useState<'sales' | 'attendance' | 'inventory'>('sales')

   useEffect(() => {
      const fetchOrders = async () => {
         const { data, error } = await supabase.from('orders').select('*').order('createdAt', { ascending: false })
         if (data && !error) {
            const mappedOrders = data.map((o: any) => ({
               ...o,
               createdAt: o.createdAt || o.created_at || new Date().toISOString()
            })) as Order[]
            setOrders(mappedOrders)
         }
      }

      const fetchAttendance = async () => {
         const { data, error } = await supabase.from('attendance').select('*').order('date', { ascending: false })
         if (data && !error) {
            setAttendance(data as AttendanceRecord[])
         }
         setLoading(false)
      }

      const fetchInventory = async () => {
         const { data, error } = await supabase.from('inventory').select('*')
         if (data && !error) {
            setInventory(data as InventoryItem[])
         }
      }

      fetchOrders()
      fetchAttendance()
      fetchInventory()

      const subOrders = supabase.channel('reports_orders')
         .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
         .subscribe()
      
      const subAtt = supabase.channel('reports_attendance')
         .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, fetchAttendance)
         .subscribe()

      const subInv = supabase.channel('reports_inventory')
         .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, fetchInventory)
         .subscribe()

      return () => {
         supabase.removeChannel(subOrders)
         supabase.removeChannel(subAtt)
         supabase.removeChannel(subInv)
      }
   }, [])

   // Process Sales Data for Chart
   const salesByDay = orders.reduce((acc: any, order) => {
      const day = new Date(order.createdAt || new Date()).toLocaleDateString('en-US', { weekday: 'short' })
      acc[day] = (acc[day] || 0) + (order.total || 0)
      return acc
   }, {})

   const chartData = Object.keys(salesByDay).map(day => ({
      name: day,
      total: salesByDay[day]
   }))

   const totalSales = orders.reduce((s, o) => s + (o.total || 0), 0)
   const completedOrders = orders.filter(o => o.status === 'delivered').length
   const avgOrderValue = totalSales / (orders.length || 1)

   const totalInvValue = inventory.reduce((s, i) => s + ((i.currentStock || 0) * (i.unitPrice || 0)), 0)
   const lowStockCount = inventory.filter(i => (i.currentStock || 0) <= (i.minStockLevel || 0)).length

   function handleExportCSV() {
      let csv = ""
      let filename = `report_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`

      if (activeTab === 'sales') {
         csv = "Order #,User,Total,Status,Date\n" +
            orders.map(o => `${o.orderNumber},${o.userName},${o.total},${o.status},${new Date(o.createdAt || new Date()).toLocaleString()}`).join("\n")
      } else if (activeTab === 'attendance') {
         csv = "Employee,Date,Check In,Check Out,Hours,Status\n" +
            attendance.map(a => `${a.employeeName},${a.date},${a.checkIn},${a.checkOut},${a.hoursWorked},${a.status}`).join("\n")
      } else {
         csv = "Item,Category,Stock,Unit,Price,Min Level\n" +
            inventory.map(i => `${i.name},${i.category},${i.currentStock},${i.unit},${i.unitPrice},${i.minStockLevel}`).join("\n")
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
   }

   if (loading) {
      return (
         <div className="bg-white flex items-center justify-center min-h-screen px-6">
            <div className="flex flex-col items-center gap-4">
               <BarChart3 className="animate-bounce text-primary" size={40} />
               <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Generating Reports...</p>
            </div>
         </div>
      )
   }

   return (
      <div className="bg-gray-50 min-h-screen pb-20">

         {/* Header */}
         <div className="admin-header h-32 flex-col !items-start !justify-center gap-4">
            <div className="flex items-center justify-between w-full">
               <div>
                  <h1 className="text-xl font-black text-gray-900 tracking-tight">System Reports</h1>
                  <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">Analytics & Performance Logs</p>
               </div>
               <button onClick={handleExportCSV} className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all">
                  <Download size={16} /> Export
               </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-gray-100">
               {(['sales', 'attendance', 'inventory'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                     className={cn('pb-4 px-2 text-[10px] sm:text-xs font-black capitalize transition-all relative',
                        activeTab === tab ? 'text-primary' : 'text-gray-400 font-bold uppercase tracking-widest')}>
                     {tab} Analytics
                     {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full" />}
                  </button>
               ))}
            </div>
         </div>

         <div className="p-5">
            {activeTab === 'sales' ? (
               <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 gap-6">
                     <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                           <div className="w-10 h-10 bg-green-50 rounded-2xl flex items-center justify-center text-green-600">
                              <TrendingUp size={20} />
                           </div>
                           <span className="text-[10px] font-black text-green-600 bg-green-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                              <ArrowUpRight size={12} /> +12%
                           </span>
                        </div>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Total Sales</p>
                        <p className="text-2xl font-black text-gray-900 mt-1">{formatPrice(totalSales)}</p>
                     </div>

                     <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                           <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                              <BarChart3 size={20} />
                           </div>
                           <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                              <ArrowUpRight size={12} /> +8%
                           </span>
                        </div>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Completed Orders</p>
                        <p className="text-2xl font-black text-gray-900 mt-1">{completedOrders}</p>
                     </div>

                     <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                           <div className="w-10 h-10 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
                              <Users size={20} />
                           </div>
                           <span className="text-[10px] font-black text-red-600 bg-red-50 px-2.5 py-1 rounded-full flex items-center gap-1">
                              <ArrowDownRight size={12} /> -3%
                           </span>
                        </div>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Average Value</p>
                        <p className="text-2xl font-black text-gray-900 mt-1">{formatPrice(avgOrderValue)}</p>
                     </div>
                  </div>

                  {/* Chart */}
                  <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
                     <div className="flex items-center justify-between mb-8">
                        <h3 className="text-lg font-black text-gray-900 uppercase tracking-tighter">Sales Performance</h3>
                        <select className="bg-gray-50 border-none rounded-xl text-xs font-bold px-4 py-2 outline-none">
                           <option>Last 7 Days</option>
                           <option>Last 30 Days</option>
                        </select>
                     </div>
                     <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                           <AreaChart data={chartData}>
                              <defs>
                                 <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#F4A11B" stopOpacity={0.1} />
                                    <stop offset="95%" stopColor="#F4A11B" stopOpacity={0} />
                                 </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#999', fontSize: 12, fontWeight: 700 }} dy={10} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#999', fontSize: 12, fontWeight: 700 }} tickFormatter={(v) => `Rs.${v}`} />
                              <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', fontWeight: 800 }} />
                              <Area type="monotone" dataKey="total" stroke="#F4A11B" strokeWidth={4} fillOpacity={1} fill="url(#colorTotal)" />
                           </AreaChart>
                        </ResponsiveContainer>
                     </div>
                  </div>

               </div>
            ) : activeTab === 'inventory' ? (
               <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* Inventory Stats */}
                  <div className="grid grid-cols-1 gap-6">
                     <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Total Inventory Value</p>
                        <p className="text-2xl font-black text-gray-900 mt-1">{formatPrice(totalInvValue)}</p>
                     </div>
                     <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Items Below Min Level</p>
                        <p className="text-2xl font-black text-red-500 mt-1">{lowStockCount} Items</p>
                     </div>
                  </div>

                  {/* Inventory Table */}
                  <div className="bg-white rounded-[40px] overflow-hidden border border-gray-100 shadow-sm">
                     <div className="overflow-x-auto scrollbar-hide">
                        <table className="w-full text-left border-collapse">
                           <thead>
                              <tr className="bg-gray-50 border-b border-gray-100">
                                 <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Item Name</th>
                                 <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Category</th>
                                 <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Current Stock</th>
                                 <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Unit Price</th>
                                 <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Status</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-50">
                              {inventory.map(item => (
                                 <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-8 py-5">
                                       <span className="text-sm font-black text-gray-900">{item.name}</span>
                                    </td>
                                    <td className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">{item.category}</td>
                                    <td className="px-8 py-5 text-sm font-bold text-gray-900 text-center">{item.currentStock} {item.unit}</td>
                                    <td className="px-8 py-5 text-sm font-black text-gray-900 text-right">{formatPrice(item.unitPrice)}</td>
                                    <td className="px-8 py-5 text-right">
                                       <span className={cn('text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest',
                                          (item.currentStock || 0) <= (item.minStockLevel || 0) ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600')}>
                                          {(item.currentStock || 0) <= (item.minStockLevel || 0) ? 'Restock' : 'OK'}
                                       </span>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>
               </div>
            ) : (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {/* Attendance List */}
                  <div className="bg-white rounded-[40px] overflow-x-auto border border-gray-100 shadow-sm scrollbar-hide">
                     <table className="w-full text-left border-collapse">
                        <thead>
                           <tr className="bg-gray-50 border-b border-gray-100">
                              <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Employee</th>
                              <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                              <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Check In</th>
                              <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Check Out</th>
                              <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Duration</th>
                              <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Status</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                           {attendance.map(record => (
                              <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                                 <td className="px-8 py-5">
                                    <div className="flex items-center gap-3">
                                       <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center font-black text-gray-400 text-xs">
                                          {record.employeeName?.charAt(0)}
                                       </div>
                                       <span className="text-sm font-bold text-gray-900">{record.employeeName}</span>
                                    </div>
                                 </td>
                                 <td className="px-8 py-5 text-sm font-medium text-gray-500">{record.date}</td>
                                 <td className="px-8 py-5 text-sm font-bold text-gray-900">{record.checkIn ? formatTime(new Date(record.checkIn)) : '--:--'}</td>
                                 <td className="px-8 py-5 text-sm font-bold text-gray-900">{record.checkOut ? formatTime(new Date(record.checkOut)) : '--:--'}</td>
                                 <td className="px-8 py-5 text-sm font-black text-primary">{record.hoursWorked ?? 0} hrs</td>
                                 <td className="px-8 py-5 text-right">
                                    <span className={cn('text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest',
                                       record.status === 'present' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600')}>
                                       {record.status}
                                    </span>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </div>
            )}
         </div>

         <AdminBottomNav />
      </div>
   )
}
