// ─── User / Auth ────────────────────────────────────────────
export type UserRole = 'student' | 'lecturer' | 'guest' | 'admin' | 'employee'

export interface User {
  uid: string
  name: string
  email: string
  role: UserRole
  studentId?: string
  hostelBlock?: string
  roomNumber?: string
  phone?: string
  avatarUrl?: string
  createdAt: Date
}

// ─── Menu ────────────────────────────────────────────────────
export type FoodCategory = 'breakfast' | 'lunch' | 'dinner' | 'snacks' | 'beverages'

export interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  category: FoodCategory
  imageUrl: string
  available: boolean
  outOfStock: boolean
  rating: number
  totalRatings: number
  createdAt: Date
  updatedAt: Date
}

// ─── Orders ──────────────────────────────────────────────────
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
export type DeliveryType = 'self_pickup' | 'hostel_delivery'
export type PaymentMethod = 'card' | 'qr_scan'

export interface OrderItem {
  menuItemId: string
  name: string
  price: number
  quantity: number
  imageUrl: string
}

export interface Order {
  id: string
  orderNumber: string
  userId: string
  userName: string
  items: OrderItem[]
  status: OrderStatus
  deliveryType: DeliveryType
  deliveryAddress?: string
  paymentMethod: PaymentMethod
  subtotal: number
  deliveryFee: number
  tax: number
  total: number
  feedbackSubmitted?: boolean
  createdAt: any // Allow Firestore Timestamp or Date
  updatedAt: any
}

export interface OrderFeedback {
  id: string
  orderId: string
  orderNumber: string
  userId: string
  userName: string
  rating: number
  comment: string
  items: string[] // names of items rated
  tags?: string[] // e.g., ['Taste', 'Freshness']
  photoUrl?: string
  createdAt: any
}

// ─── Inventory ───────────────────────────────────────────────
export interface InventoryItem {
  id: string
  name: string
  category: string
  unit: string
  currentStock: number
  minStockLevel: number
  maxStockLevel: number
  unitPrice: number
  supplierId?: string
  lastRestocked: any
  createdAt: any
}

// ─── Employee ────────────────────────────────────────────────
export type ShiftType = 'day' | 'night'

export interface Employee {
  id: string
  name: string
  phone: string
  email: string
  role: string
  shift: ShiftType
  dailyWage: number
  joinedAt: any
  avatarUrl?: string
  isActive: boolean
}

export interface AttendanceRecord {
  id: string
  employeeId: string
  employeeName: string
  registrationNumber?: string
  date: string // YYYY-MM-DD
  checkIn?: any
  checkOut?: any
  hoursWorked?: number
  status: 'present' | 'absent' | 'late'
}

// ─── Supplier ────────────────────────────────────────────────
export interface Supplier {
  id: string
  name: string
  contactPerson: string
  phone: string
  email: string
  address: string
  itemCategories: string[]
  nextPaymentDate?: any // Timestamp
  outstandingAmount?: number
  createdAt: any
}

// ─── Cart ─────────────────────────────────────────────────────
export interface CartItem {
  menuItem: MenuItem
  quantity: number
}

export interface CartState {
  items: CartItem[]
  deliveryType: DeliveryType
  deliveryAddress: string
  paymentMethod: PaymentMethod
}

// ─── Dashboard Stats ─────────────────────────────────────────
export interface DashboardStats {
  todaySales: number
  totalOrders: number
  lowStockCount: number
  pendingOrders: number
}

export interface SalesTrendPoint {
  day: string
  sales: number
}

// ─── Employee Tasks ──────────────────────────────────────────
export interface EmployeeTask {
  id: string
  employeeId: string // UID from users collection
  employeeName: string
  taskTitle: string
  description?: string
  status: 'pending' | 'completed'
  date: string // YYYY-MM-DD
  createdAt: any
}
