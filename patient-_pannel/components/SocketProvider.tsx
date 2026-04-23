"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initializeSocket, disconnectSocket } from "@/lib/socket";

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const token = localStorage.getItem("token");
    
    if (token) {
      try {
        setTimeout(() => {
          initializeSocket(token);
        }, 100);
      } catch (error) {
        console.warn("Failed to initialize socket:", error);
      }
    } else {
      disconnectSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, [pathname]);

  return <>{children}</>;
}

