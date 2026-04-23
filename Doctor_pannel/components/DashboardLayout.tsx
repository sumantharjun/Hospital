"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  actionButton?: React.ReactNode;
}

export default function DashboardLayout({
  children,
  title,
  description,
  actionButton,
}: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("user");
      const storedToken = localStorage.getItem("token");
      
      if (!storedUser || !storedToken) {
        router.replace("/");
        return;
      }
      
      setUser(JSON.parse(storedUser));
      setLoading(false);
    }
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't show layout on login/signup pages
  const publicPages = ["/"];
  if (publicPages.includes(pathname || "")) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar - Always visible on desktop, toggleable on mobile */}
      <Sidebar isMobileOpen={isMobileMenuOpen} setIsMobileOpen={setIsMobileMenuOpen} />

      {/* Main content area - Add left margin on desktop to account for fixed sidebar */}
      <div className="flex-1 flex flex-col lg:ml-64 min-w-0 w-full">
        {/* Navbar */}
        <Navbar user={user} onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />

        {/* Page header */}
        {(title || actionButton) && (
          <div className="bg-white border-b border-gray-200">
            <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="flex-1 min-w-0">
                  {title && (
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 leading-[100%] break-words">
                      {title}
                    </h1>
                  )}
                  {description && (
                    <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-600 leading-[100%] break-words">
                      {description}
                    </p>
                  )}
                </div>
                {actionButton && <div className="flex-shrink-0">{actionButton}</div>}
              </div>
            </div>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 px-3 sm:px-4 lg:px-8 py-4 sm:py-6 w-full overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

