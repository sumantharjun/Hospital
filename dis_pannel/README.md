# Distributor Warehouse Portal

A comprehensive distributor management system built with Next.js, TypeScript, and Tailwind CSS.

## Features

- **Distributor Profile & Login** - Secure authentication for distributor staff
- **Warehouse Inventory Management** - Manage warehouse stock, add/update items, track quantities
- **Low Stock Alerts** - Receive auto-alerts when pharmacy stock is low
- **Purchase Requests** - Process pharmacy purchase requests (Accept → Assign delivery agent → Dispatch)
- **Delivery Agent Management** - Assign and manage delivery agents
- **Real-time Delivery Tracking** - Track delivery agents and update status (Picked → Out For Delivery → Delivered)
- **Invoices & Documents** - Generate invoices and manage supply chain documents
- **Reports** - Download order history and generate reports

## Tech Stack

- **Framework**: Next.js 16
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Notifications**: React Hot Toast

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Backend API running on `http://localhost:4000` (or configure `NEXT_PUBLIC_API_BASE`)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set environment variables (optional):
```bash
# Create .env.local file
NEXT_PUBLIC_API_BASE=http://localhost:4000
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
dist/
├── components/          # Reusable components (Layout, etc.)
├── pages/              # Next.js pages (routes)
│   ├── index.tsx       # Login page
│   ├── dashboard.tsx   # Main dashboard
│   ├── warehouse-inventory.tsx
│   ├── low-stock-alerts.tsx
│   ├── purchase-requests.tsx
│   ├── delivery-agents.tsx
│   ├── delivery-tracking.tsx
│   ├── invoices.tsx
│   └── profile.tsx
├── services/           # API service layer
├── types/              # TypeScript type definitions
├── utils/              # Utility functions (auth, constants)
└── styles/             # Global styles
```

## Features Overview

### Warehouse Inventory
- Add, edit, and delete warehouse stock items
- Track quantities and minimum stock levels
- Search and filter inventory items
- View total inventory value

### Low Stock Alerts
- Auto-refreshing alerts from pharmacy low stock notifications
- Filter by read/unread status
- Mark alerts as read
- View alert details and metadata

### Purchase Requests
- View all pharmacy purchase orders
- Accept or reject orders
- Assign delivery agents to orders
- Update order status (Pending → Accepted → Dispatched → Delivered)

### Delivery Agents
- View all delivery agents
- Filter by status (Available, Busy, Offline)
- Update agent status
- Track current orders assigned to agents

### Delivery Tracking
- Real-time tracking of active deliveries
- Update delivery status (Picked → Out For Delivery → Delivered)
- View delivery agent information
- Track delivery timestamps

### Invoices
- Generate and download invoices for delivered orders
- View invoice details (amount, tax, total)
- Access delivery proof images
- Track revenue and order statistics

## API Integration

The application integrates with a backend API. All API calls are centralized in `services/api.ts` and use authentication tokens stored in localStorage.

## Authentication

- Users must have the `DISTRIBUTOR` role to access the portal
- Authentication tokens are stored in localStorage
- Protected routes automatically redirect to login if not authenticated

## Build for Production

```bash
npm run build
npm start
```

## License

Private project - All rights reserved
