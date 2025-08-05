"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

export default function FinancialsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useTranslation('financials');

  const financialNavItems = [
    {
      name: t("allDailyReports.title"),
      href: "/dashboard/financials",
    },
    {
      name: t("allExpenses.title"),
      href: "/dashboard/financials/expenses",
    },
    {
      name: t("navigation.bankDeposits"),
      href: "/dashboard/financials/deposits",
    },
    {
      name: t("navigation.analytics"),
      href: "/dashboard/financials/analytics",
    },
    {
      name: t("navigation.bankVerification"),
      href: "/dashboard/financials/verification",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex border-b">
        {financialNavItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "px-4 py-2 text-sm font-medium",
              pathname === item.href || (item.href === "/dashboard/financials/expenses" && pathname === "/dashboard/financials/company-expenses")
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