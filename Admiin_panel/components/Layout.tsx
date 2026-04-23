import { ReactNode, useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster } from "react-hot-toast";
import {
  DashboardIcon, HospitalIcon, PharmacyIcon, DistributorIcon, DoctorIcon,
  PatientIcon, OrdersIcon, ReportsIcon, TemplatesIcon, ActivityIcon,
  FinanceIcon, SettingsIcon, LogoutIcon, MenuIcon, CloseIcon, ClockIcon,
  ReceptionistIcon, ChartBarIcon, BellIcon,
} from "./Icons";

interface User { id: string; name: string; email: string; role: string; }
interface LayoutProps { children: ReactNode; user?: User | null; currentPage?: string; }
type NavItem = {
  path: string; label: string; icon: React.ComponentType<{ className?: string }>;
  section?: string; superAdminOnly?: boolean; badge?: string;
};

const NAV_ITEMS: NavItem[] = [
  { path: "/dashboard",               label: "Overview",          icon: DashboardIcon,    section: "Home" },
  { path: "/hospital-management",     label: "Hospitals",         icon: HospitalIcon,     section: "Management" },
  { path: "/pharmacy-management",     label: "Pharmacies",        icon: PharmacyIcon,     section: "Management" },
  { path: "/branch-stock",            label: "Branch Stock",      icon: PharmacyIcon,     section: "Management", superAdminOnly: true },
  { path: "/distributor-management",  label: "Distributors",      icon: DistributorIcon,  section: "Management" },
  { path: "/doctor-management",       label: "Doctors",           icon: DoctorIcon,       section: "Management" },
  { path: "/receptionist-management", label: "Receptionists",     icon: ReceptionistIcon, section: "Management" },
  { path: "/nurse-management",        label: "Nurses",            icon: PatientIcon,      section: "Management" },
  { path: "/infrastructure",          label: "Rooms & Beds",      icon: HospitalIcon,     section: "Hospital" },
  { path: "/hospital-config",         label: "Config & Services", icon: SettingsIcon,     section: "Hospital" },
  { path: "/ip-management",           label: "IP Patients",       icon: PatientIcon,      section: "Hospital" },
  { path: "/certificates",            label: "Certificates",      icon: ReportsIcon,      section: "Hospital" },
  { path: "/vitals-monitor",          label: "Vitals Monitor",    icon: ActivityIcon,     section: "Hospital" },
  { path: "/medications-overview",    label: "Medications",       icon: DoctorIcon,       section: "Hospital" },
  { path: "/nurse-alerts",            label: "Nurse Alerts",      icon: BellIcon,         section: "Hospital" },
  { path: "/schedules",               label: "Schedules",         icon: ClockIcon,        section: "Operations" },
  { path: "/patient-panel",           label: "Patients",          icon: PatientIcon,      section: "Operations" },
  { path: "/orders",                  label: "Orders",            icon: OrdersIcon,       section: "Operations" },
  { path: "/hospital-reports",        label: "Hospital Reports",  icon: ChartBarIcon,     section: "Reports" },
  { path: "/patient-consolidated",    label: "Patient Summary",   icon: PatientIcon,      section: "Reports" },
  { path: "/reports",                 label: "Pharmacy Reports",  icon: ReportsIcon,      section: "Reports" },
  { path: "/templates",               label: "Templates",         icon: TemplatesIcon,    section: "Reports" },
  { path: "/activity-panel",          label: "Activity",          icon: ActivityIcon,     section: "Reports" },
  { path: "/finance",                 label: "Finance",           icon: FinanceIcon,      section: "Reports" },
  { path: "/settings",               label: "Settings",          icon: SettingsIcon,     section: "System" },
];

const SECTION_COLORS: Record<string, string> = {
  Home: "text-cyan-200",
  Management: "text-emerald-200",
  Hospital: "text-sky-200",
  Operations: "text-amber-200",
  Reports: "text-rose-200",
  System: "text-slate-300",
};

function getBreadcrumb(pathname: string): string {
  const item = NAV_ITEMS.find((i) => i.path === pathname);
  return item?.label ?? pathname.replace(/^\//, "").replace(/-/g, " ");
}

function NavGroup({ section, items, pathname, onNavigate }: {
  section: string; items: NavItem[]; pathname: string; onNavigate: (path: string) => void;
}) {
  return (
    <div className="mb-4">
      <p className={`px-3 mb-1 text-[10px] font-bold uppercase section-label ${SECTION_COLORS[section] ?? "text-slate-400"}`}>
        {section}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => {
          const isActive = pathname === item.path;
          return (
            <motion.button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              whileHover={{ x: isActive ? 0 : 3 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 nav-item text-sm font-semibold transition-all ${
                isActive ? "nav-item-active" : "nav-item-idle"
              }`}
            >
              <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
              <span className="flex-1 text-left truncate">{item.label}</span>
              {item.badge && (
                <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">{item.badge}</span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export default function Layout({ children, user }: LayoutProps) {
  const router = useRouter();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => { setIsMobileOpen(false); }, [router.pathname]);

  const logout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
    router.push("/");
  };

  const filtered = NAV_ITEMS.filter((item) => !item.superAdminOnly || user?.role === "SUPER_ADMIN");
  const sections = Array.from(new Set(filtered.map((i) => i.section || "Main")));

  const SidebarContent = ({ onNavigate }: { onNavigate: (path: string) => void }) => (
    <>
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl sidebar-brand flex items-center justify-center flex-shrink-0">
            <HospitalIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white tracking-wide">HealthCare</h1>
            <p className="text-[10px] text-slate-300 font-medium">Admin Portal</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 min-h-0 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700/60">
        {sections.map((section) => (
          <NavGroup
            key={section}
            section={section}
            items={filtered.filter((i) => (i.section || "Main") === section)}
            pathname={router.pathname}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      {/* User Footer */}
      {user && (
        <div className="px-4 py-4 border-t border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.name}</p>
              <span className="text-[10px] font-semibold text-cyan-200 bg-cyan-500/10 border border-cyan-300/20 px-1.5 py-0.5 rounded-full">
                {user.role.replace("_", " ")}
              </span>
            </div>
          </div>
          <motion.button
            onClick={logout}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm font-medium hover:bg-red-500/20 transition-all"
          >
            <LogoutIcon className="w-4 h-4" />
            <span>Sign out</span>
          </motion.button>
        </div>
      )}
    </>
  );

  return (
    <div className="app-shell h-screen flex overflow-hidden">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: "#fff",
            color: "#1e293b",
            borderRadius: "12px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
            padding: "12px 16px",
            fontSize: "14px",
            fontWeight: "500",
            maxWidth: "360px",
          },
          success: { iconTheme: { primary: "#10b981", secondary: "#fff" }, style: { borderLeft: "4px solid #10b981" } },
          error:   { iconTheme: { primary: "#ef4444", secondary: "#fff" }, style: { borderLeft: "4px solid #ef4444" } },
        }}
      />

      {/* Mobile Menu Toggle */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-xl bg-slate-900/90 shadow-xl border border-slate-700/60 hover:bg-slate-800 transition-colors"
        aria-label="Open menu"
      >
        <MenuIcon className="w-5 h-5 text-white" />
      </button>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.aside
              initial={{ x: -280, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -280, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="lg:hidden fixed left-0 top-0 w-64 h-screen sidebar-shell flex flex-col z-50"
            >
              <div className="absolute top-4 right-4">
                <button onClick={() => setIsMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                  <CloseIcon className="w-4 h-4 text-slate-200" />
                </button>
              </div>
              <SidebarContent onNavigate={(path) => { router.push(path); setIsMobileOpen(false); }} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 w-60 h-screen sidebar-shell flex-col z-50">
        <SidebarContent onNavigate={(path) => router.push(path)} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden w-full lg:ml-60">
        {/* Top Bar */}
        <div className="sticky top-0 z-10 topbar px-4 sm:px-6 lg:px-8 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm pl-10 lg:pl-0">
              <span className="text-slate-400">Admin</span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-800 capitalize">{getBreadcrumb(router.pathname)}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 bg-white/80 border border-slate-200 rounded-full px-3 py-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow" />
                <span>Live</span>
              </div>
              {user && (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-500 flex items-center justify-center text-white font-bold text-xs shadow">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-slate-700">{user.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto page-shell">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-12">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
