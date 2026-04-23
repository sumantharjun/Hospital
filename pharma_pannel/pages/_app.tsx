import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { initializeSocket, disconnectSocket } from "@/services/socket";
import toast from "react-hot-toast";

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    // Handle unhandled promise rejections to prevent runtime errors
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Prevent the default error handling (runtime error display)
      event.preventDefault();
      
      const error = event.reason;
      const errorMessage = error?.message || error?.error || String(error) || "An error occurred";
      
      // Silent handling - no console.error
      // Only show toast if it's an API error (has message) and not already handled
      if (errorMessage && typeof errorMessage === "string" && errorMessage.length < 200) {
        // Check if it's already handled by the component (common error patterns)
        const isAlreadyHandled = 
          errorMessage.toLowerCase().includes("inventory items") ||
          errorMessage.toLowerCase().includes("no inventory") ||
          errorMessage.toLowerCase().includes("already exists") ||
          errorMessage.toLowerCase().includes("failed to create audit") ||
          errorMessage.toLowerCase().includes("failed to update");
        
        if (!isAlreadyHandled) {
          toast.error(`❌ ${errorMessage}`, { duration: 5000 });
        }
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    const token = getAuthToken();
    
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
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      disconnectSocket();
    };
  }, [router]);

  return <Component {...pageProps} />;
}
