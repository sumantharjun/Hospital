import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster } from "react-hot-toast";
import { clearAuth } from "@/utils/auth";
import { DistributorIcon, DashboardIcon, LogoutIcon, MenuIcon, CloseIcon, InventoryIcon, AlertIcon, OrdersIcon, TruckIcon, LocationIcon, FileIcon, UserIcon, PharmacyIcon } from "./Icons";

interface LayoutProps {
  user: any;
  currentPage?: string;
  children: React.ReactNode;
}

const menuItems = [
  { name: "Dashboard", path: "/dashboard", icon: DashboardIcon, page: "dashboard" },
  { name: "Pharmacies", path: "/pharmacies", icon: PharmacyIcon, page: "pharmacies" },
  { name: "Warehouse Inventory", path: "/warehouse-inventory", icon: InventoryIcon, page: "warehouse-inventory" },
  { name: "Low Stock Alerts", path: "/low-stock-alerts", icon: AlertIcon, page: "low-stock-alerts" },
  { name: "Purchase Requests", path: "/purchase-requests", icon: OrdersIcon, page: "purchase-requests" },
  { name: "Delivery Agents", path: "/delivery-agents", icon: TruckIcon, page: "delivery-agents" },
  { name: "Delivery Tracking", path: "/delivery-tracking", icon: LocationIcon, page: "delivery-tracking" },
  { name: "Finance", path: "/finance", icon: FileIcon, page: "finance" },
  { name: "Invoices", path: "/invoices", icon: FileIcon, page: "invoices" },
  { name: "Profile", path: "/profile", icon: UserIcon, page: "profile" },
];

export default function Layout({ user, currentPage = "dashboard", children }: LayoutProps) {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [router.pathname]);

  const handleLogout = () => {
    clearAuth();
    router.push("/");
  };

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden relative">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#fff",
            color: "#000",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            padding: "12px 16px",
            fontSize: "14px",
            fontWeight: "500",
          },
          success: {
            iconTheme: {
              primary: "#00A86B",
              secondary: "#fff",
            },
            style: {
              borderLeft: "4px solid #00A86B",
            },
          },
          error: {
            iconTheme: {
              primary: "#DC3545",
              secondary: "#fff",
            },
            style: {
              borderLeft: "4px solid #DC3545",
            },
          },
        }}
      />
      
      {/* Top Navbar - Mobile Menu Button */}
      <nav className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between h-14">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-lg bg-blue-900 text-white shadow-sm hover:bg-blue-800 transition-colors"
            aria-label="Open menu"
          >
            <MenuIcon className="w-5 h-5" />
          </button>
          <h1 className="text-base font-bold text-gray-900">Distributor Portal</h1>
          <div className="w-9"></div> {/* Spacer for centering */}
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />
            <motion.aside
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -100, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="lg:hidden fixed left-0 top-0 w-72 h-screen border-r border-gray-300 bg-white shadow-xl flex flex-col z-50"
            >
              {/* Mobile Header */}
              <div className="px-6 py-6 border-b border-gray-300 bg-blue-900 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-white flex items-center justify-center shadow-md">
                    <DistributorIcon className="w-7 h-7 text-blue-900" />
                  </div>
                  <div>
                    <h1 className="text-base font-bold tracking-wide text-white">
                      Distributor Portal
                    </h1>
                    <p className="text-xs text-blue-200">Warehouse Management</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-blue-800 transition-colors"
                  aria-label="Close menu"
                >
                  <CloseIcon className="w-6 h-6 text-white" />
                </button>
              </div>

              {/* Mobile Navigation */}
              <nav className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
                {menuItems.map((item, index) => {
                  const isActive = router.pathname === item.path;
                  return (
                    <motion.button
                      key={item.path}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.1 + index * 0.05 }}
                      onClick={() => {
                        router.push(item.path);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                        isActive
                          ? "bg-blue-50 text-blue-900 border-l-4 border-blue-900 shadow-sm"
                          : "text-gray-700 hover:bg-gray-50 hover:text-blue-900 border-l-4 border-transparent"
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="flex-1 text-left">{item.name}</span>
                      {isActive && (
                        <motion.div
                          layoutId="activeIndicatorMobile"
                          className="h-2 w-2 rounded-full bg-blue-900"
                        />
                      )}
                    </motion.button>
                  );
                })}
              </nav>

              {/* Mobile Footer */}
              {user && (
                <div className="px-6 py-4 border-t border-gray-300 bg-gray-50 flex-shrink-0">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full bg-blue-900 flex items-center justify-center text-white font-semibold shadow-md">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                      <p className="text-xs text-gray-600 truncate">{user.email}</p>
                    </div>
                  </div>
                  <motion.button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-medium hover:bg-red-100 transition-all"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <LogoutIcon className="w-5 h-5" />
                    <span>Logout</span>
                  </motion.button>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
      
      {/* Desktop Sidebar - Always Visible */}
      <motion.aside
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="hidden lg:flex fixed left-0 top-0 w-72 h-screen border-r border-gray-300 bg-white shadow-lg flex-col z-30"
      >
        {/* Fixed Header */}
        <div className="px-6 py-6 border-b border-gray-300 bg-blue-900 flex-shrink-0">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-3"
          >
            <div className="h-12 w-12 rounded-lg bg-white flex items-center justify-center shadow-md">
              <DistributorIcon className="w-7 h-7 text-blue-900" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-wide text-white">
                Distributor Portal
              </h1>
              <p className="text-xs text-blue-200">Warehouse Management</p>
            </div>
          </motion.div>
        </div>

        {/* Scrollable Navigation */}
        <nav className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {menuItems.map((item, index) => {
            const isActive = router.pathname === item.path;
            return (
              <motion.button
                key={item.path}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                onClick={() => router.push(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-blue-50 text-blue-900 border-l-4 border-blue-900 shadow-sm"
                    : "text-gray-700 hover:bg-gray-50 hover:text-blue-900 border-l-4 border-transparent"
                }`}
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.98 }}
              >
                <item.icon className="w-5 h-5" />
                <span className="flex-1 text-left">{item.name}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="h-2 w-2 rounded-full bg-blue-900"
                  />
                )}
              </motion.button>
            );
          })}
        </nav>

        {/* Fixed Footer with User Info */}
        {user && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="px-6 py-4 border-t border-gray-300 bg-gray-50 flex-shrink-0"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-blue-900 flex items-center justify-center text-white font-semibold shadow-md">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                <p className="text-xs text-gray-600 truncate">{user.email}</p>
              </div>
            </div>
            <motion.button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-medium hover:bg-red-100 transition-all"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <LogoutIcon className="w-5 h-5" />
              <span>Logout</span>
            </motion.button>
          </motion.div>
        )}
      </motion.aside>

      {/* Main Content - Scrollable with Sidebar Offset */}
      <motion.main
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex-1 overflow-y-auto h-full w-full lg:ml-72"
      >
        <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 lg:p-8 pb-12 pt-14 lg:pt-6">
          {children}
        </div>
      </motion.main>
    </div>
  );
}
