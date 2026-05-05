import { useEffect } from "react";
import { useRouter } from "next/router";

export default function InvoiceRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/reception/invoices");
  }, []);
  return null;
}
