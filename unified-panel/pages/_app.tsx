import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { initializeSocket, disconnectSocket } from "@/services/socket";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hour in milliseconds

  // Function to logout user
  const handleLogout = () => {
    if (typeof window !== "undefined") {
      // Clear localStorage
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      // Disconnect socket
      disconnectSocket();
      // Redirect to login page
      router.push("/");
    }
  };

  // Function to reset inactivity timer
  const resetInactivityTimer = () => {
    // Clear existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // Only set timer if user is logged in
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      return;
    }

    // Set new timer for 1 hour
    inactivityTimerRef.current = setTimeout(() => {
      console.log("⏰ Inactivity timeout: Auto-logging out after 1 hour of inactivity");
      handleLogout();
    }, INACTIVITY_TIMEOUT);
  };

  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") {
      return;
    }

    // Add global error handler to suppress WebSocket errors
    const handleError = (event: ErrorEvent) => {
      // Suppress WebSocket-related errors to prevent runtime errors in Next.js
      if (
        event.error?.message?.includes("websocket") ||
        event.error?.message?.includes("WebSocket") ||
        event.error?.message?.includes("socket.io") ||
        event.message?.includes("websocket") ||
        event.message?.includes("WebSocket") ||
        event.message?.includes("socket.io") ||
        event.filename?.includes("socket") ||
        event.filename?.includes("websocket")
      ) {
        event.preventDefault(); // Prevent the error from showing in Next.js error overlay
        // Silently handle WebSocket errors
        if (process.env.NODE_ENV === "production") {
          console.error("WebSocket error suppressed:", event.error || event.message);
        }
        return false;
      }
    };

    // Add unhandled promise rejection handler for WebSocket errors
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const errorMessage = event.reason?.message || event.reason?.toString() || "";
      if (
        errorMessage.includes("websocket") ||
        errorMessage.includes("WebSocket") ||
        errorMessage.includes("socket.io")
      ) {
        event.preventDefault(); // Prevent the error from showing in Next.js error overlay
        // Silently handle WebSocket promise rejections
        if (process.env.NODE_ENV === "production") {
          console.error("WebSocket promise rejection suppressed:", event.reason);
        }
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    // Get token from localStorage
    const token = localStorage.getItem("token");
    
    if (token) {
      try {
        // Delay socket initialization slightly to ensure error handlers are set up
        setTimeout(() => {
          initializeSocket(token);
        }, 100);
      } catch (error) {
        // Silently handle socket initialization errors
        // The app should continue working even if WebSocket fails
        console.warn("Failed to initialize socket:", error);
      }

      // Initialize inactivity timer for logged-in users
      resetInactivityTimer();

      // Track user activity events to reset timer
      const activityEvents = [
        "mousedown",
        "mousemove",
        "keypress",
        "scroll",
        "touchstart",
        "click",
        "keydown",
      ];

      const handleActivity = () => {
        resetInactivityTimer();
      };

      // Add event listeners for user activity
      activityEvents.forEach((event) => {
        window.addEventListener(event, handleActivity, { passive: true });
      });

      // Also track visibility changes (when user switches tabs/windows)
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          resetInactivityTimer();
        }
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        window.removeEventListener("error", handleError);
        window.removeEventListener("unhandledrejection", handleUnhandledRejection);
        
        // Remove activity event listeners
        activityEvents.forEach((event) => {
          window.removeEventListener(event, handleActivity);
        });
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        
        // Clear inactivity timer
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
        }
        
        disconnectSocket();
      };
    } else {
      disconnectSocket();
      
      return () => {
        window.removeEventListener("error", handleError);
        window.removeEventListener("unhandledrejection", handleUnhandledRejection);
        disconnectSocket();
      };
    }
  }, [router]);

  return <Component {...pageProps} />;
}
