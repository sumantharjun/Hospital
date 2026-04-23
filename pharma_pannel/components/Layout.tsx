import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import { clearAuth } from "@/utils/auth";
import { PharmacyIcon, DashboardIcon, LogoutIcon, MenuIcon, CloseIcon, InventoryIcon, OrdersIcon, PrescriptionIcon, RefreshIcon, TruckIcon, ReceiptIcon, ChartIcon, ClipboardCheckIcon, SettingsIcon } from "./Icons";

interface LayoutProps {
  user: any;
  currentPage?: string;
  children: React.ReactNode;
}

type MenuItem = { name: string; path: string; icon: React.ComponentType<{ className?: string }>; page: string; section?: string };

const menuItems: MenuItem[] = [
  { name: "Dashboard", path: "/dashboard", icon: DashboardIcon, page: "dashboard", section: "Home" },
  { name: "Billing", path: "/billing", icon: ReceiptIcon, page: "billing", section: "Daily Ops" },
  { name: "Orders", path: "/orders", icon: OrdersIcon, page: "orders", section: "Daily Ops" },
  { name: "Prescriptions", path: "/prescriptions", icon: PrescriptionIcon, page: "prescriptions", section: "Daily Ops" },
  { name: "Inventory", path: "/inventory", icon: InventoryIcon, page: "inventory", section: "Stock" },
  { name: "Audit", path: "/audit", icon: ClipboardCheckIcon, page: "audit", section: "Stock" },
  { name: "Order from Distributor", path: "/distributor", icon: RefreshIcon, page: "distributor", section: "Stock" },
  { name: "Invoices", path: "/invoices", icon: ReceiptIcon, page: "invoices", section: "Stock" },
  { name: "Delivery", path: "/delivery", icon: TruckIcon, page: "delivery-agents", section: "Delivery" },
  { name: "Finance & Reports", path: "/finance-reports", icon: ChartIcon, page: "finance", section: "Reports" },
  { name: "Settings", path: "/settings", icon: SettingsIcon, page: "settings", section: "System" },
];

function getBreadcrumb(pathname: string): string {
  const item = menuItems.find((i) => i.path === pathname);
  return item?.name ?? pathname.replace(/^\//, "").replace(/-/g, " ");
}

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
          <h1 className="text-base font-bold text-gray-900">Pharmacy Portal</h1>
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
                    <PharmacyIcon className="w-7 h-7 text-blue-900" />
                  </div>
                  <div>
                    <h1 className="text-base font-bold tracking-wide text-white">
                      Pharmacy Portal
                    </h1>
                    <p className="text-xs text-blue-200">Management System</p>
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

              {/* Mobile Navigation - Grouped */}
              <nav className="flex-1 overflow-y-auto px-4 py-4">
                {(() => {
                  const sections = Array.from(new Set(menuItems.map((i) => i.section || "Main")));
                  return sections.map((section) => (
                    <div key={section} className="mb-5">
                      <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-blue-200">
                        {section}
                      </p>
                      <div className="space-y-1">
                        {menuItems.filter((i) => (i.section || "Main") === section).map((item) => {
                          const isActive = router.pathname === item.path;
                          return (
                            <motion.button
                              key={item.path}
                              onClick={() => {
                                router.push(item.path);
                                setIsMobileMenuOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                isActive
                                  ? "bg-white/20 text-white border-l-2 border-white"
                                  : "text-blue-100 hover:bg-white/10 border-l-2 border-transparent"
                              }`}
                            >
                              <item.icon className="w-5 h-5 flex-shrink-0" />
                              <span className="flex-1 text-left">{item.name}</span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
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
              <PharmacyIcon className="w-7 h-7 text-blue-900" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-wide text-white">
                Pharmacy Portal
              </h1>
              <p className="text-xs text-blue-200">Management System</p>
            </div>
          </motion.div>
        </div>

        {/* Scrollable Navigation - Grouped */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
          {(() => {
            const sections = Array.from(new Set(menuItems.map((i) => i.section || "Main")));
            return sections.map((section) => (
              <div key={section} className="mb-5">
                <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  {section}
                </p>
                <div className="space-y-1">
                  {menuItems.filter((i) => (i.section || "Main") === section).map((item) => {
                    const isActive = router.pathname === item.path;
                    return (
                      <motion.button
                        key={item.path}
                        onClick={() => router.push(item.path)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          isActive
                            ? "bg-blue-50 text-blue-900 border-l-2 border-blue-600"
                            : "text-gray-700 hover:bg-gray-50 hover:text-blue-800 border-l-2 border-transparent"
                        }`}
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.99 }}
                      >
                        <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-blue-600" : "text-gray-500"}`} />
                        <span className="flex-1 text-left">{item.name}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
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
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex-1 overflow-y-auto h-full w-full lg:ml-72 bg-gray-50/80"
      >
        <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-2">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-sm">
            <span className="text-gray-500">Pharmacy</span>
            <span className="text-gray-300">/</span>
            <span className="font-medium text-gray-800">{getBreadcrumb(router.pathname)}</span>
          </div>
        </div>
        <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-8 pb-12 pt-4">
          {children}
        </div>
      </motion.main>
    </div>
  );
}
