import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notifications | Royal Express Fleet Management",
  description: "Manage WhatsApp group alerts and automated notifications for your fleet operations.",
};

export default function NotificationsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

