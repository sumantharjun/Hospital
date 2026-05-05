import { useEffect } from "react";
import { useRouter } from "next/router";

export default function RegisterRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/reception/dashboard");
  }, []);
  return null;
}
