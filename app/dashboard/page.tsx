"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
// import { ChevronRight, Bus, Package, Wrench, Truck } from "lucide-react";
// import Link from "next/link";

export default function Dashboard() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to maintenance page
    router.replace("/dashboard/maintenance");
  }, [router]);

  // This UI will only be shown briefly before redirection
  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  );
} 