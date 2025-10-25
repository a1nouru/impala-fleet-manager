import type { Metadata } from "next";
import { DashboardLayoutClient } from "./client-layout";

export const metadata: Metadata = {
  title: "Dashboard | Impala Express Fleet Management",
  description: "Manage your bus fleet, track maintenance, and monitor spare parts inventory.",
};

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
} 