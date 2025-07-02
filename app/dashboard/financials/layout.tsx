"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

const financialNavItems = [
  {
    name: "All Daily Reports",
    href: "/dashboard/financials",
  },
  {
    name: "Bank Deposits",
    href: "/dashboard/financials/deposits",
  },
  {
    name: "Analytics",
    href: "/dashboard/financials/analytics",
  },
];

export default function FinancialsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div className="flex border-b">
        {financialNavItems.map((item) => (
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