"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  DashboardIcon,
  PatientsIcon,
  AppointmentsIcon,
  HistoryIcon,
  ReportsIcon,
  PrescriptionIcon,
  PaymentIcon,
  LogoutIcon,
  MenuIcon,
  CloseIcon,
  HospitalIcon,
  IPAdmissionIcon,
  OPRegistrationIcon,
  ServicesIcon,
  ServiceBillIcon,
  IPBillingIcon,
  DischargeIcon,
  RevenueIcon,
  SearchIcon,
  QueueIcon,
  BedIcon,
  TokenIcon,
  StethoscopeIcon,
  AlertIcon,
} from "./ReceptionIcons";
import { LoadingOverlay } from "./LoadingSpinner";

const navItems = [
  { path: "/reception/dashboard",          label: "Dashboard",          icon: DashboardIcon,       section: "Home",                description: "Overview & today's stats" },
  { path: "/reception/token-queue",        label: "Token Queue",        icon: QueueIcon,           section: "Home",                description: "Live OPD queue & token display" },
  { path: "/reception/search",             label: "Patient Search",     icon: SearchIcon,          section: "Home",                description: "Quick search across IP / OP / Services" },
  { path: "/reception/doctors",            label: "Doctor Board",       icon: StethoscopeIcon,     section: "Home",                description: "Doctor availability & queue depth" },
  { path: "/reception/beds",               label: "Bed Status",         icon: BedIcon,             section: "Home",                description: "Real-time bed availability" },
  { path: "/reception/emergency",          label: "Emergency",          icon: AlertIcon,           section: "Home",                description: "Emergency quick intake & triage" },
  { path: "/reception/patients",           label: "Patients",           icon: PatientsIcon,        section: "OPD & Patients",      description: "Register & search patients" },
  { path: "/reception/appointments",       label: "Appointments",       icon: AppointmentsIcon,    section: "OPD & Patients",      description: "Book & manage appointments" },
  { path: "/reception/history",            label: "Patient History",    icon: HistoryIcon,         section: "OPD & Patients",      description: "Visit history by patient" },
  { path: "/reception/ip-registration",   label: "IP Admission",       icon: IPAdmissionIcon,     section: "IP / OP / Services",  description: "Register in-patient admission" },
  { path: "/reception/op-registration",   label: "OP Registration",    icon: OPRegistrationIcon,  section: "IP / OP / Services",  description: "Register out-patient" },
  { path: "/reception/services-registration", label: "Services Billing", icon: ServicesIcon,      section: "IP / OP / Services",  description: "Direct lab/procedure billing" },
  { path: "/reception/service-billing",   label: "Service Bill View",  icon: ServiceBillIcon,     section: "IP / OP / Services",  description: "View & print service bills" },
  { path: "/reception/ip-billing",        label: "IP Billing",         icon: IPBillingIcon,       section: "IP / OP / Services",  description: "View & manage IP bill" },
  { path: "/reception/discharge",         label: "Discharge",          icon: DischargeIcon,       section: "IP / OP / Services",  description: "Manage patient discharge" },
  { path: "/reception/revenue",           label: "Revenue & Invoices", icon: RevenueIcon,         section: "Finance",             description: "Total revenue, collections & invoices" },
  { path: "/reception/reports",           label: "Reports",            icon: ReportsIcon,         section: "Finance",             description: "Daily & doctor-wise reports" },
  { path: "/reception/prescriptions",     label: "Prescriptions",      icon: PrescriptionIcon,    section: "Finance",             description: "Doctor prescription view" },
  { path: "/reception/handover",          label: "Shift Handover",     icon: ReportsIcon,         section: "Finance",             description: "End-of-shift summary & handover" },
];

function getBreadcrumb(pathname, items) {
  const item = items.find((i) => pathname === i.path || pathname?.startsWith(i.path + "/"));
  return item?.label ?? pathname?.replace("/reception/", "").replace(/-/g, " ") ?? "Reception";
}

export default function ReceptionLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const t = localStorage.getItem("token") || localStorage.getItem("recption_token");
    const u = localStorage.getItem("user") || localStorage.getItem("recption_user");
    if (!t || !u) {
      router.replace("/");
      return;
    }
    setUser(JSON.parse(u));
  }, [mounted, router]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("recption_token");
    localStorage.removeItem("recption_user");
    router.replace("/");
  };

  if (!mounted || !user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center">
        <LoadingOverlay text="Loading…" />
      </div>
    );
  }

  const sections = [...new Set(navItems.map((i) => i.section))];

  const NavContent = ({ isMobile = false }) => (
    <nav className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
      {sections.map((section) => (
        <div key={section} className="mb-5">
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-[#718096]">
            {section}
          </p>
          <div className="space-y-1">
            {navItems
              .filter((i) => i.section === section)
              .map((item) => {
                const isActive = pathname === item.path || pathname?.startsWith(item.path + "/");
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => {
                      router.push(item.path);
                      if (isMobile) setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-all text-left border-l-2 ${
                      isActive
                        ? "bg-[#e3f2fd] text-[#0d47a1] border-[#0d47a1]"
                        : "text-[#2d3748] hover:bg-[#f5f7fa] border-transparent hover:border-[#cbd5e0]"
                    }`}
                  >
                    <item.icon className={`w-5 h-5 shrink-0 ${isActive ? "text-[#0d47a1]" : "text-[#718096]"}`} />
                    <div className="flex-1 min-w-0">
                      <span className="block">{item.label}</span>
                      {item.description && (
                        <span className="block text-[11px] text-gray-500 dark:text-zinc-500 mt-0.5 truncate">{item.description}</span>
                      )}
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
        <div className="h-11 w-11 rounded-sm bg-white flex items-center justify-center border border-white/20">
          <HospitalIcon className="w-6 h-6 text-[#0d47a1]" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-white uppercase">OPD Reception</h1>
          <p className="text-[11px] text-blue-100">Medical Portal</p>
        </div>
      </div>
    </div>
  );

  const UserFooter = () => (
    <div className="px-5 py-4 border-t border-[#cbd5e0] bg-[#f5f7fa] shrink-0">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-9 w-9 rounded-sm bg-[#0d47a1] flex items-center justify-center text-white font-semibold text-sm border border-[#0a3d91]">
          {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#1a202c] truncate">{user?.name || "User"}</p>
          <p className="text-xs text-[#4a5568] truncate">{user?.email || ""}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-sm bg-white border border-[#cbd5e0] text-[#1a202c] text-sm font-medium hover:bg-[#e2e8f0] transition-colors"
      >
        <LogoutIcon className="w-5 h-5" />
        <span>Logout</span>
      </button>
    </div>
  );

  return (
    <div className="h-screen bg-[#f5f7fa] flex overflow-hidden relative">
      {/* Mobile menu button */}
      <button
        type="button"
        onClick={() => setIsMobileMenuOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-sm bg-white shadow border border-[#cbd5e0] hover:bg-[#e2e8f0]"
        aria-label="Open menu"
      >
        <MenuIcon className="w-6 h-6 text-[#2d3748]" />
      </button>

      {/* Mobile overlay & sidebar */}
      {isMobileMenuOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden
          />
          <aside className="lg:hidden fixed left-0 top-0 w-72 max-w-[85vw] h-screen border-r-2 border-[#0d47a1] bg-white shadow-xl flex flex-col z-50">
            <div className="px-5 py-5 border-b-2 border-[#0d47a1] bg-[#0d47a1] flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-sm bg-white flex items-center justify-center">
                  <HospitalIcon className="w-6 h-6 text-[#0d47a1]" />
                </div>
                <div>
                  <h1 className="text-sm font-bold text-white uppercase">OPD Reception</h1>
                  <p className="text-[11px] text-blue-100">Medical Portal</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsMobileMenuOpen(false)} className="p-2 hover:bg-[#0a3d91] text-white" aria-label="Close menu">
                <CloseIcon className="w-6 h-6" />
              </button>
            </div>
            <NavContent isMobile />
            <UserFooter />
          </aside>
        </>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 w-72 h-screen border-r-2 border-[#cbd5e0] bg-white flex-col z-30">
        <SidebarHeader />
        <NavContent />
        <UserFooter />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto h-full w-full lg:ml-72 bg-[#f5f7fa]">
        {/* Breadcrumb - gov style */}
        <div className="sticky top-0 z-10 bg-white border-b border-[#cbd5e0] px-4 sm:px-6 lg:px-8 py-2">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-sm text-[#4a5568]">
            <span> Medical</span>
            <span className="text-[#cbd5e0]">/</span>
            <span className="font-semibold text-[#1a202c]">{getBreadcrumb(pathname, navItems)}</span>
          </div>
        </div>
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-12 pt-4">
          {children}
        </div>
      </main>
    </div>
  );
}
