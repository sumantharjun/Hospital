import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { initializeSocket, disconnectSocket } from "@/services/socket";
import { getAuthToken } from "@/utils/auth";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

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
      disconnectSocket();
    };
  }, [router]);

  return <Component {...pageProps} />;
}
