"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Toaster } from "react-hot-toast";
import { clearSession, getStoredUser, getStoredToken } from "@/lib/auth";
import {
  DashboardIcon, PatientsIcon, AppointmentsIcon, HistoryIcon, ReportsIcon,
  PrescriptionIcon, PaymentIcon, LogoutIcon, MenuIcon, CloseIcon, HospitalIcon,
  OPRegistrationIcon, ServicesIcon, ServiceBillIcon, RevenueIcon, SearchIcon,
} from "@/components/Icons";

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  section: string;
  description?: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: "/reception/dashboard",              label: "Dashboard",          icon: DashboardIcon,       section: "Home",           description: "Overview & today's stats" },
  { path: "/reception/search",                 label: "Patient Search",     icon: SearchIcon,          section: "Home",           description: "Quick search across patients" },
  { path: "/reception/patients",               label: "Patients",           icon: PatientsIcon,        section: "OPD & Patients", description: "Register & search patients" },
  { path: "/reception/appointments",           label: "Appointments",       icon: AppointmentsIcon,    section: "OPD & Patients", description: "Book & manage appointments" },
  { path: "/reception/history",                label: "Patient History",    icon: HistoryIcon,         section: "OPD & Patients", description: "Visit history by patient" },
  { path: "/reception/op-registration",        label: "OP Registration",    icon: OPRegistrationIcon,  section: "OP / Services",  description: "Register out-patient" },
  { path: "/reception/services-registration",  label: "Services Billing",   icon: ServicesIcon,        section: "OP / Services",  description: "Procedure / treatment billing" },
  { path: "/reception/service-billing",        label: "Service Bill View",  icon: ServiceBillIcon,     section: "OP / Services",  description: "View & print service bills" },
  { path: "/reception/revenue",                label: "Revenue & Invoices", icon: RevenueIcon,         section: "Finance",        description: "Total revenue, collections & invoices" },
  { path: "/reception/reports",                label: "Reports",            icon: ReportsIcon,         section: "Finance",        description: "Daily & revenue reports" },
  { path: "/reception/prescriptions",          label: "Prescriptions",      icon: PrescriptionIcon,    section: "Finance",        description: "Prescription view & print" },
  { path: "/reception/billing",                label: "Billing",            icon: PaymentIcon,         section: "Finance",        description: "Medicine & consultation billing" },
];

function getBreadcrumb(pathname: string): string {
  const item = NAV_ITEMS.find((i) => pathname === i.path || pathname?.startsWith(i.path + "/"));
  return item?.label ?? pathname?.replace("/reception/", "").replace(/-/g, " ") ?? "Reception";
}

export default function ReceptionLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const token = getStoredToken();
    const u = getStoredUser();
    if (!token || !u) { router.replace("/"); return; }
    setUser(u);
  }, [router]);

  useEffect(() => { setIsMobileOpen(false); }, [pathname]);

  const logout = () => {
    clearSession();
    router.push("/");
  };

  const sections = [...new Set(NAV_ITEMS.map((i) => i.section))];

  const NavContent = ({ onNavigate }: { onNavigate: (p: string) => void }) => (
    <nav className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
      {sections.map((section) => (
        <div key={section} className="mb-5">
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-[#718096]">{section}</p>
          <div className="space-y-1">
            {NAV_ITEMS.filter((i) => i.section === section).map((item) => {
              const isActive = pathname === item.path || pathname?.startsWith(item.path + "/");
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => onNavigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-all text-left border-l-2 ${
                    isActive ? "bg-[#e3f2fd] text-[#0d47a1] border-[#0d47a1]" : "text-[#2d3748] hover:bg-[#f5f7fa] border-transparent hover:border-[#cbd5e0]"
                  }`}
                >
                  <item.icon className={`w-5 h-5 shrink-0 ${isActive ? "text-[#0d47a1]" : "text-[#718096]"}`} />
                  <div className="flex-1 min-w-0">
                    <span className="block">{item.label}</span>
                    {item.description && <span className="block text-[11px] text-gray-500 mt-0.5 truncate">{item.description}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const SidebarHeader = () => (
    <div className="px-5 py-5 border-b-2 border-[#0d47a1] bg-[#0d47a1] shrink-0">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-sm bg-white flex items-center justify-center">
          <HospitalIcon className="w-5 h-5 text-[#0d47a1]" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-white uppercase">OPD Reception</h1>
          <p className="text-[11px] text-blue-100">Dermatology Clinic</p>
        </div>
      </div>
    </div>
  );

  const UserFooter = () => (
    <div className="px-5 py-4 border-t border-[#cbd5e0] bg-[#f5f7fa] shrink-0">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-9 w-9 rounded-sm bg-[#0d47a1] flex items-center justify-center text-white font-semibold text-sm">
          {(user?.name || "R").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#1a202c] truncate">{user?.name || "User"}</p>
          <p className="text-xs text-[#4a5568] truncate">{user?.email || ""}</p>
        </div>
      </div>
      <button type="button" onClick={logout} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-sm bg-white border border-[#cbd5e0] text-[#1a202c] text-sm font-medium hover:bg-[#e2e8f0] transition-colors">
        <LogoutIcon className="w-4 h-4" /><span>Logout</span>
      </button>
    </div>
  );

  if (!user) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="h-screen bg-[#f5f7fa] flex overflow-hidden relative">
      <Toaster position="top-right" toastOptions={{ duration: 3500, style: { borderRadius: "8px", fontSize: "14px" } }} />

      {/* Mobile toggle */}
      <button type="button" onClick={() => setIsMobileOpen(true)} className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-sm bg-white shadow border border-[#cbd5e0]">
        <MenuIcon className="w-5 h-5 text-[#2d3748]" />
      </button>

      {/* Mobile sidebar */}
      {isMobileOpen && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setIsMobileOpen(false)} />
          <aside className="lg:hidden fixed left-0 top-0 w-72 max-w-[85vw] h-screen border-r-2 border-[#0d47a1] bg-white shadow-xl flex flex-col z-50">
            <div className="px-5 py-5 border-b-2 border-[#0d47a1] bg-[#0d47a1] flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-sm bg-white flex items-center justify-center"><HospitalIcon className="w-5 h-5 text-[#0d47a1]" /></div>
                <div><h1 className="text-sm font-bold text-white uppercase">OPD Reception</h1><p className="text-[11px] text-blue-100">Dermatology Clinic</p></div>
              </div>
              <button type="button" onClick={() => setIsMobileOpen(false)} className="p-2 hover:bg-[#0a3d91] text-white"><CloseIcon className="w-5 h-5" /></button>
            </div>
            <NavContent onNavigate={(p) => { router.push(p); setIsMobileOpen(false); }} />
            <UserFooter />
          </aside>
        </>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 w-72 h-screen border-r-2 border-[#cbd5e0] bg-white flex-col z-30">
        <SidebarHeader />
        <NavContent onNavigate={(p) => router.push(p)} />
        <UserFooter />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto h-full w-full lg:ml-72 bg-[#f5f7fa]">
        <div className="sticky top-0 z-10 bg-white border-b border-[#cbd5e0] px-4 sm:px-6 lg:px-8 py-2">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-sm text-[#4a5568]">
            <span>Reception</span><span className="text-[#cbd5e0]">/</span>
            <span className="font-semibold text-[#1a202c] capitalize">{getBreadcrumb(pathname)}</span>
          </div>
        </div>
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-12 pt-4">{children}</div>
      </main>
    </div>
  );
}
