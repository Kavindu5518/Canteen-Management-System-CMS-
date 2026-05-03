-- 1. Remove Old Tables
DROP TABLE IF EXISTS employee_tasks CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS order_feedback CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 2. Users Table
CREATE TABLE users (
  uid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  "studentId" TEXT,
  "hostelBlock" TEXT,
  "roomNumber" TEXT,
  phone TEXT,
  "avatarUrl" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Menu Items Table
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  category TEXT NOT NULL,
  "imageUrl" TEXT,
  available BOOLEAN DEFAULT TRUE,
  "outOfStock" BOOLEAN DEFAULT FALSE,
  rating NUMERIC DEFAULT 0,
  "totalRatings" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Orders Table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderNumber" TEXT NOT NULL,
  "userId" UUID REFERENCES users(uid),
  "userName" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  "deliveryType" TEXT NOT NULL,
  "deliveryAddress" TEXT,
  "paymentMethod" TEXT NOT NULL,
  subtotal NUMERIC NOT NULL,
  "deliveryFee" NUMERIC NOT NULL,
  tax NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  "feedbackSubmitted" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Order Items Table
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" UUID REFERENCES orders(id) ON DELETE CASCADE,
  "menuItemId" UUID REFERENCES menu_items(id),
  name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  quantity INTEGER NOT NULL,
  "imageUrl" TEXT
);

-- 6. Order Feedback Table
CREATE TABLE order_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" UUID REFERENCES orders(id) ON DELETE CASCADE,
  "orderNumber" TEXT,
  "userId" UUID REFERENCES users(uid),
  "userName" TEXT,
  rating INTEGER NOT NULL,
  comment TEXT,
  items TEXT[],
  tags TEXT[],
  "photoUrl" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Inventory Table
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  "currentStock" NUMERIC NOT NULL DEFAULT 0,
  "minStockLevel" NUMERIC NOT NULL DEFAULT 0,
  "maxStockLevel" NUMERIC NOT NULL DEFAULT 0,
  "unitPrice" NUMERIC NOT NULL DEFAULT 0,
  "supplierId" UUID,
  "lastRestocked" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Suppliers Table
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  "contactPerson" TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  "itemCategories" TEXT[],
  "nextPaymentDate" TIMESTAMPTZ,
  "outstandingAmount" NUMERIC DEFAULT 0,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inventory ADD CONSTRAINT fk_supplier FOREIGN KEY ("supplierId") REFERENCES suppliers(id) ON DELETE SET NULL;

-- 9. Employees Table
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  shift TEXT NOT NULL,
  "dailyWage" NUMERIC NOT NULL,
  "joinedAt" TIMESTAMPTZ DEFAULT NOW(),
  "avatarUrl" TEXT,
  "isActive" BOOLEAN DEFAULT TRUE
);

-- 10. Attendance Table
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "employeeId" UUID REFERENCES employees(id) ON DELETE CASCADE,
  "employeeName" TEXT,
  "registrationNumber" TEXT,
  date DATE NOT NULL,
  "checkIn" TIMESTAMPTZ,
  "checkOut" TIMESTAMPTZ,
  "hoursWorked" NUMERIC,
  status TEXT NOT NULL
);

-- 11. Employee Tasks Table
CREATE TABLE employee_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "employeeId" UUID REFERENCES users(uid),
  "employeeName" TEXT,
  "taskTitle" TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  date DATE NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

NOTIFY pgrst, 'reload schema';
