"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface NavItem {
  name: string;
  href: string;
  icon: string;
  description: string;
}

const navigation: NavItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: "📊",
    description: "Overview and statistics",
  },
  {
    name: "Appointments",
    href: "/appointments",
    icon: "📅",
    description: "Manage patient appointments",
  },
  {
    name: "Schedule",
    href: "/schedule",
    icon: "⏰",
    description: "Set availability and slots",
  },
  {
    name: "Wallet",
    href: "/wallet",
    icon: "💰",
    description: "View received payments",
  },
  {
    name: "Notifications",
    href: "/news",
    icon: "🔔",
    description: "Notifications and updates",
  },
  {
    name: "Settings",
    href: "/settings/mfa",
    icon: "⚙️",
    description: "Account and security",
  },
];

interface SidebarProps {
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

export default function Sidebar({ isMobileOpen, setIsMobileOpen }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-40 h-screen transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          w-64 bg-white border-r border-gray-200 shadow-lg lg:shadow-sm
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Brand */}
          <div className="flex items-center gap-3 px-6 py-6 border-b border-gray-200">
            <div className="h-10 w-10 rounded-lg bg-blue-900 flex items-center justify-center shadow-md">
              <span className="text-xl text-white font-bold">D</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-[100%]">Doctor Portal</h2>
              <p className="text-xs text-gray-500 leading-[100%]">Healthcare Management</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`
                    flex items-start gap-3 px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer
                    ${
                      isActive
                        ? "bg-blue-50 text-blue-900 border-l-4 border-blue-900 shadow-sm"
                        : "text-gray-700 hover:bg-gray-50 hover:text-blue-900"
                    }
                  `}
                >
                  <span className="text-xl mt-0.5">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold text-sm leading-[100%] ${isActive ? "text-blue-900" : "text-gray-900"}`}>
                      {item.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 leading-[100%] line-clamp-1">
                      {item.description}
                    </div>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center leading-[100%]">
              © 2024 Doctor Portal
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

