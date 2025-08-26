"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function HRLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const hrNavItems = [
    {
      name: "Vehicle Damages",
      href: "/dashboard/hr",
    },
    {
      name: "Employees",
      href: "/dashboard/hr/employees",
    },
    {
      name: "Payroll",
      href: "/dashboard/hr/payroll",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex border-b">
        {hrNavItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "px-4 py-2 text-sm font-medium",
              pathname === item.href
                ? "border-b-2 border-black text-black"
                : "text-muted-foreground hover:text-black"
            )}
          >
            {item.name}
          </Link>
        ))}
      </div>
      <div>{children}</div>
    </div>
  );
} 
