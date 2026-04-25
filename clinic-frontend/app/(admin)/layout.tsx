"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster } from "react-hot-toast";
import { clearSession, getStoredUser, getStoredToken } from "@/lib/auth";
import { initializeSocket, disconnectSocket } from "@/services/socket";
import {
  DashboardIcon, PatientIcon, ReportsIcon, TemplatesIcon, ActivityIcon,
  FinanceIcon, SettingsIcon, LogoutIcon, MenuIcon, CloseIcon, HospitalIcon,
  ClockIcon, ReceptionistIcon, ChartBarIcon,
} from "@/components/Icons";

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  section: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: "/admin/dashboard",               label: "Overview",           icon: DashboardIcon,    section: "Home" },
  { path: "/admin/receptionist-management", label: "Receptionists",      icon: ReceptionistIcon, section: "Management" },
  { path: "/admin/schedules",               label: "Schedules",          icon: ClockIcon,        section: "Operations" },
  { path: "/admin/patient-panel",           label: "Patients",           icon: PatientIcon,      section: "Operations" },
  { path: "/admin/patient-consolidated",    label: "Patient Summary",    icon: ChartBarIcon,     section: "Reports" },
  { path: "/admin/reports",                 label: "Reports",            icon: ReportsIcon,      section: "Reports" },
  { path: "/admin/templates",               label: "Templates",          icon: TemplatesIcon,    section: "Reports" },
  { path: "/admin/activity-panel",          label: "Activity",           icon: ActivityIcon,     section: "Reports" },
  { path: "/admin/finance",                 label: "Finance",            icon: FinanceIcon,      section: "Reports" },
  { path: "/admin/inventory",               label: "Inventory",          icon: HospitalIcon,     section: "Clinic" },
  { path: "/admin/pricing",                 label: "Pricing",            icon: ChartBarIcon,     section: "Clinic" },
  { path: "/admin/settings",               label: "Settings",           icon: SettingsIcon,     section: "System" },
];

function getBreadcrumb(pathname: string): string {
  const item = NAV_ITEMS.find((i) => pathname === i.path || pathname.startsWith(i.path + "/"));
  return item?.label ?? pathname.replace("/admin/", "").replace(/-/g, " ");
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const token = getStoredToken();
    const u = getStoredUser();
    if (!token || !u) { router.replace("/"); return; }
    setUser(u);
    try { initializeSocket(token); } catch { /* socket is optional */ }
    return () => { disconnectSocket(); };
  }, [router]);

  useEffect(() => { setIsMobileOpen(false); }, [pathname]);

  const logout = () => {
    clearSession();
    disconnectSocket();
    router.push("/");
  };

  const sections = [...new Set(NAV_ITEMS.map((i) => i.section))];

  const NavContent = ({ onNavigate }: { onNavigate: (p: string) => void }) => (
    <nav className="flex-1 overflow-y-auto px-3 py-4 min-h-0">
      {sections.map((section) => (
        <div key={section} className="mb-4">
          <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{section}</p>
          <div className="space-y-0.5">
            {NAV_ITEMS.filter((i) => i.section === section).map((item) => {
              const isActive = pathname === item.path || pathname?.startsWith(item.path + "/");
              return (
                <motion.button
                  key={item.path}
                  onClick={() => onNavigate(item.path)}
                  whileHover={{ x: isActive ? 0 : 3 }}
                  whileTap={{ scale: 0.98 }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all text-left ${
                    isActive ? "bg-blue-600 text-white shadow-md" : "text-slate-300 hover:bg-white/10"
                  }`}
                >
                  <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span className="flex-1 truncate">{item.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const SidebarShell = ({ onNavigate }: { onNavigate: (p: string) => void }) => (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow">DC</div>
          <div>
            <h1 className="text-sm font-semibold text-white">Dermatology Clinic</h1>
            <p className="text-[10px] text-slate-400">Admin Portal</p>
          </div>
        </div>
      </div>
      <NavContent onNavigate={onNavigate} />
      {/* User footer */}
      {user && (
        <div className="px-4 py-4 border-t border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center text-white font-bold text-xs shadow flex-shrink-0">
              {(user.name || "A").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400 truncate">{user.role?.replace("_", " ")}</p>
            </div>
          </div>
          <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm font-medium hover:bg-red-500/20 transition-all">
            <LogoutIcon className="w-4 h-4" /><span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );

  if (!user) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      <Toaster position="top-right" toastOptions={{ duration: 3500, style: { borderRadius: "10px", fontSize: "14px" } }} />

      {/* Mobile menu toggle */}
      <button onClick={() => setIsMobileOpen(true)} className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-xl bg-slate-900 shadow-xl border border-slate-700 hover:bg-slate-800 transition-colors">
        <MenuIcon className="w-5 h-5 text-white" />
      </button>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMobileOpen(false)} className="lg:hidden fixed inset-0 bg-black/60 z-40" />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="lg:hidden fixed left-0 top-0 w-64 h-screen z-50">
              <div className="absolute top-4 right-4 z-10">
                <button onClick={() => setIsMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300"><CloseIcon className="w-4 h-4" /></button>
              </div>
              <SidebarShell onNavigate={(p) => { router.push(p); setIsMobileOpen(false); }} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 w-60 h-screen flex-col z-50">
        <SidebarShell onNavigate={(p) => router.push(p)} />
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden w-full lg:ml-60">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm pl-10 lg:pl-0">
              <span className="text-gray-400">Admin</span>
              <span className="text-gray-300">/</span>
              <span className="font-semibold text-gray-800 capitalize">{getBreadcrumb(pathname)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live</span>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-12">{children}</div>
        </div>
      </main>
    </div>
  );
}
