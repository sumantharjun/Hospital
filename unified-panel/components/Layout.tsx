import { ReactNode, useState, useEffect } from "react";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster } from "react-hot-toast";
import {
  DashboardIcon, HospitalIcon, PharmacyIcon, DistributorIcon, DoctorIcon,
  PatientIcon, OrdersIcon, ReportsIcon, TemplatesIcon, ActivityIcon,
  FinanceIcon, SettingsIcon, LogoutIcon, MenuIcon, CloseIcon, ClockIcon,
  ReceptionistIcon, ChartBarIcon, BellIcon,
  PatientsIcon, AppointmentsIcon, HistoryIcon, PrescriptionIcon, PaymentIcon,
  IPAdmissionIcon, OPRegistrationIcon, ServicesIcon, ServiceBillIcon,
  IPBillingIcon, DischargeIcon, RevenueIcon, SearchIcon, QueueIcon, BedIcon,
  TokenIcon, StethoscopeIcon, AlertIcon,
  FlaskIcon, TestTubeIcon, MicroscopeIcon, SampleIcon, LabResultIcon,
} from "./Icons";

interface User { id: string; name: string; email: string; role: string; }
interface LayoutProps { children: ReactNode; user?: User | null; currentPage?: string; }
type NavItem = {
  path: string; label: string; icon: React.ComponentType<{ className?: string }>;
  section?: string; superAdminOnly?: boolean; badge?: string;
};

const ADMIN_NAV: NavItem[] = [
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

const RECEPTION_NAV: NavItem[] = [
  { path: "/reception/dashboard",              label: "Dashboard",          icon: DashboardIcon,       section: "Home" },
  { path: "/reception/token-queue",            label: "Token Queue",        icon: QueueIcon,           section: "Home" },
  { path: "/reception/search",                 label: "Patient Search",     icon: SearchIcon,          section: "Home" },
  { path: "/reception/doctors",                label: "Doctor Board",       icon: StethoscopeIcon,     section: "Home" },
  { path: "/reception/beds",                   label: "Bed Status",         icon: BedIcon,             section: "Home" },
  { path: "/reception/emergency",              label: "Emergency",          icon: AlertIcon,           section: "Home" },
  { path: "/reception/patients",               label: "Patients",           icon: PatientsIcon,        section: "OPD & Patients" },
  { path: "/reception/appointments",           label: "Appointments",       icon: AppointmentsIcon,    section: "OPD & Patients" },
  { path: "/reception/history",                label: "Patient History",    icon: HistoryIcon,         section: "OPD & Patients" },
  { path: "/reception/ip-registration",        label: "IP Admission",       icon: IPAdmissionIcon,     section: "IP / OP / Services" },
  { path: "/reception/op-registration",        label: "OP Registration",    icon: OPRegistrationIcon,  section: "IP / OP / Services" },
  { path: "/reception/services-registration",  label: "Services Billing",   icon: ServicesIcon,        section: "IP / OP / Services" },
  { path: "/reception/service-billing",        label: "Service Bill View",  icon: ServiceBillIcon,     section: "IP / OP / Services" },
  { path: "/reception/ip-billing",             label: "IP Billing",         icon: IPBillingIcon,       section: "IP / OP / Services" },
  { path: "/reception/discharge",              label: "Discharge",          icon: DischargeIcon,       section: "IP / OP / Services" },
  { path: "/reception/revenue",                label: "Revenue & Invoices", icon: RevenueIcon,         section: "Finance" },
  { path: "/reception/reports",                label: "Reports",            icon: ReportsIcon,         section: "Finance" },
  { path: "/reception/prescriptions",          label: "Prescriptions",      icon: PrescriptionIcon,    section: "Finance" },
  { path: "/reception/handover",               label: "Shift Handover",     icon: ReportsIcon,         section: "Finance" },
];

const LAB_NAV: NavItem[] = [
  { path: "/lab/dashboard",  label: "Dashboard",    icon: DashboardIcon,   section: "Lab Overview" },
  { path: "/lab/tests",      label: "Test Catalog", icon: FlaskIcon,       section: "Lab Overview" },
  { path: "/lab/patients",   label: "Patients",     icon: PatientsIcon,    section: "Lab Work" },
  { path: "/lab/samples",    label: "Samples",      icon: SampleIcon,      section: "Lab Work" },
  { path: "/lab/results",    label: "Results",      icon: LabResultIcon,   section: "Lab Work" },
  { path: "/lab/orders",     label: "Test Orders",  icon: OrdersIcon,      section: "Lab Work" },
  { path: "/lab/billing",    label: "Billing",      icon: IPBillingIcon,   section: "Finance" },
  { path: "/lab/reports",    label: "Reports",      icon: ChartBarIcon,    section: "Finance" },
  { path: "/lab/audit",      label: "Audit Log",    icon: ActivityIcon,    section: "System" },
  { path: "/lab/users",      label: "Users",        icon: ReceptionistIcon,section: "System" },
];

const SECTION_COLORS: Record<string, string> = {
  Home: "text-cyan-200",
  Management: "text-emerald-200",
  Hospital: "text-sky-200",
  Operations: "text-amber-200",
  Reports: "text-rose-200",
  System: "text-slate-300",
  "OPD & Patients": "text-cyan-200",
  "IP / OP / Services": "text-sky-200",
  Finance: "text-emerald-200",
  "Lab Overview": "text-cyan-200",
  "Lab Work": "text-sky-200",
};

function getBreadcrumb(pathname: string, navItems: NavItem[]): string {
  const item = navItems.find((i) => i.path === pathname || pathname.startsWith(i.path + "/"));
  return item?.label ?? pathname.replace(/^\//, "").replace(/-/g, " ").replace(/\//g, " / ");
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
          const isActive = pathname === item.path || pathname.startsWith(item.path + "/");
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

  const role = user?.role ?? "";
  const isAdmin = role === "SUPER_ADMIN" || role === "HOSPITAL_ADMIN";
  const isReceptionist = role === "RECEPTIONIST";
  const isLab = role === "LAB_TECH";

  let navItems: NavItem[] = isAdmin
    ? ADMIN_NAV.filter((i) => !i.superAdminOnly || role === "SUPER_ADMIN")
    : isReceptionist
    ? RECEPTION_NAV
    : isLab
    ? LAB_NAV
    : ADMIN_NAV.filter((i) => !i.superAdminOnly || role === "SUPER_ADMIN");

  const sections = Array.from(new Set(navItems.map((i) => i.section || "Main")));

  const breadcrumb = getBreadcrumb(router.pathname, navItems);

  const SidebarContent = ({ onNavigate }: { onNavigate: (path: string) => void }) => (
    <>
      <div className="px-4 py-5 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl sidebar-brand flex items-center justify-center flex-shrink-0">
            <HospitalIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white tracking-wide">
              {isAdmin ? "Admin" : isReceptionist ? "Reception" : isLab ? "Laboratory" : "Portal"}
            </h1>
            <p className="text-[10px] text-slate-300 font-medium">Medical Portal</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 min-h-0 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700/60">
        {sections.map((section) => (
          <NavGroup
            key={section}
            section={section}
            items={navItems.filter((i) => (i.section || "Main") === section)}
            pathname={router.pathname}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      {user && (
        <div className="px-4 py-4 border-t border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.name}</p>
              <span className="text-[10px] font-semibold text-cyan-200 bg-cyan-500/10 border border-cyan-300/20 px-1.5 py-0.5 rounded-full">
                {user.role.replace(/_/g, " ")}
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
          success: { iconTheme: { primary: "#0ea5a4", secondary: "#fff" }, style: { borderLeft: "4px solid #0ea5a4" } },
          error:   { iconTheme: { primary: "#ef4444", secondary: "#fff" }, style: { borderLeft: "4px solid #ef4444" } },
        }}
      />

      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-xl bg-slate-900/90 shadow-xl border border-slate-700/60 hover:bg-slate-800 transition-colors"
        aria-label="Open menu"
      >
        <MenuIcon className="w-5 h-5 text-white" />
      </button>

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

      <aside className="hidden lg:flex fixed left-0 top-0 w-60 h-screen sidebar-shell flex-col z-50">
        <SidebarContent onNavigate={(path) => router.push(path)} />
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden w-full lg:ml-60">
        <div className="sticky top-0 z-10 topbar px-4 sm:px-6 lg:px-8 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm pl-10 lg:pl-0">
              <span className="text-slate-400">
                {isAdmin ? "Admin" : isReceptionist ? "Reception" : isLab ? "Lab" : "Portal"}
              </span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-800 capitalize">{breadcrumb}</span>
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

        <div className="flex-1 overflow-y-auto page-shell">
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-12">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
