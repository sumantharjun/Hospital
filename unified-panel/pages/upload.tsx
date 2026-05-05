import { useEffect } from "react";
import { useRouter } from "next/router";

export default function UploadRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/reception/dashboard");
  }, []);
  return null;
}
