import { useEffect } from "react";
import { useRouter } from "next/router";

export default function DeliveryAgentsRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace("/delivery");
  }, [router]);

  return null;
}
