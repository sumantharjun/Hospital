# Pharmacy Management Portal

A comprehensive pharmacy management system built with Next.js, TypeScript, and Tailwind CSS.

## Features

- **Pharmacy Profile & Login** - Secure authentication for pharmacy staff
- **Inventory Management** - Add stock, update quantities, track expiry dates, and low stock alerts
- **Patient Orders** - Receive and process orders from patients (Accept → Pack → Assign delivery agent)
- **Prescriptions** - Receive prescriptions from doctors with auto-sync functionality
- **Delivery Tracking** - Track delivery agent status and order deliveries in real-time
- **Reports & Analytics** - Download order history and generate reports
- **Distributor Orders** - Sync stock with distributor purchase orders

## Tech Stack

- **Framework**: Next.js 16
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Notifications**: React Hot Toast

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env.local` file in the root directory:
```
NEXT_PUBLIC_API_BASE=http://localhost:4000
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
pharma/
├── components/     # Reusable React components
├── pages/          # Next.js pages and routes
├── services/       # API service functions
├── types/          # TypeScript type definitions
├── utils/          # Utility functions and constants
└── styles/         # Global styles
```

## Available Pages

- `/` - Login page
- `/dashboard` - Main dashboard with statistics
- `/inventory` - Inventory management
- `/orders` - Patient orders processing
- `/prescriptions` - Prescriptions management
- `/distributor-orders` - Distributor orders sync
- `/delivery-tracking` - Delivery agent tracking
- `/reports` - Reports and analytics
- `/profile` - User and pharmacy profile

## Build for Production

```bash
npm run build
npm start
```

## License

Private project
