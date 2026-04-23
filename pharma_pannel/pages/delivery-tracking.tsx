import { useEffect } from "react";
import { useRouter } from "next/router";

export default function DeliveryTrackingRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace("/delivery");
  }, [router]);

  return null;
}
