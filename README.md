# 🍽️ Campus Canteen Management System

Trincomalee Campus Canteen Management System — built with **Next.js 14**, **Tailwind CSS**, and **Firebase**.

---

## 📱 Screens Implemented

### Customer Subsystem
| Screen | Path | Description |
|---|---|---|
| Login | `/login` | Role-based login (Student/Lecturer/Guest) |
| Menu | `/menu` | Food categories, search, add to cart |
| Checkout | `/checkout` | Basket review, delivery, payment |
| Orders | `/orders` | Track active & past orders |
| Profile | `/profile` | Account settings, logout |

### Admin Subsystem
| Screen | Path | Description |
|---|---|---|
| Dashboard | `/admin/dashboard` | Stats, sales chart, quick actions |
| Orders | `/admin/orders` | Today's orders with status update |
| Menu Mgmt | `/admin/menu` | Add/Edit/Delete items, stock toggle |
| Inventory | `/admin/inventory` | Stock levels, low stock alerts |
| Employees | `/admin/employees` | Staff management |
| Suppliers | `/admin/suppliers` | Supplier database |

---

## 🚀 Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Firebase setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project: **"campus-canteen"**
3. Enable **Authentication** → Email/Password
4. Create **Firestore Database** (start in test mode)
5. Create **Storage** bucket
6. Go to Project Settings → Your apps → Add web app
7. Copy the config values

### 3. Environment variables
```bash
cp .env.local.example .env.local
# Edit .env.local and paste your Firebase config
```

### 4. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🏗️ Project Structure

```
src/
├── app/
│   ├── login/          # Login page
│   ├── menu/           # Customer menu
│   ├── checkout/       # Order & payment
│   ├── orders/         # Order tracking
│   ├── profile/        # Customer profile
│   └── admin/
│       ├── dashboard/  # Admin overview
│       ├── orders/     # Order management
│       ├── menu/       # Menu management
│       ├── inventory/  # Stock management
│       ├── employees/  # Staff management
│       └── suppliers/  # Supplier management
├── components/
│   ├── customer/       # Customer nav
│   └── admin/          # Admin nav
├── lib/
│   ├── firebase.ts     # Firebase config
│   └── utils.ts        # Helpers
└── types/
    └── index.ts        # TypeScript types
```

---

## 🎨 Design System

| Token | Value |
|---|---|
| Primary Color | `#F4A11B` (Orange) |
| Font | Nunito |
| Border Radius | 16–24px |
| Mobile Max Width | 430px |

---

## 🔥 Firestore Collections

```
users/        { uid, name, email, role, studentId, hostelBlock }
menuItems/    { name, description, price, category, imageUrl, available }
orders/       { orderNumber, userId, items[], status, deliveryType, total }
inventory/    { name, category, currentStock, minStockLevel }
employees/    { name, phone, shift, dailyWage, isActive }
suppliers/    { name, contactPerson, phone, itemCategories }
```

---

## 🖼️ Food Photos

Place these images in `/public/photos/`:
- `rice-curry.jpg`
- `parota.jpg`
- `pittu.jpg`
- `fried-rice.jpg`
- `tea.jpg`
- `chilli.jpg`
- `placeholder.jpg`

(Photos are already in your ZIP file under `Photo/`)

---

## 📋 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Database**: Firebase Firestore
- **Auth**: Firebase Authentication
- **Storage**: Firebase Storage
- **Charts**: Recharts
- **Icons**: Lucide React
- **Language**: TypeScript
