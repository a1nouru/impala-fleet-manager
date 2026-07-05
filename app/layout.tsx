import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/use-toast";
import { AuthProvider } from "@/context/AuthContext";
import { DebugEnvironment } from "./debug-env";
import { I18nProvider } from "@/components/I18nProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { PushOptIn } from "@/components/PushOptIn";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Impala Express - Fleet Management System (Internal)",
  description: "Internal tool for managing bus fleet, tracking maintenance, and monitoring spare parts inventory.",
  applicationName: "Impala Fleet",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Impala Fleet",
  },
  icons: {
    icon: [{ url: '/favicon.svg', href: '/favicon.svg' }],
    apple: [{ url: '/icons/apple-touch-icon-180.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <ToastProvider>
            <I18nProvider>
              {children}
            </I18nProvider>
          </ToastProvider>
          <DebugEnvironment />
          <ServiceWorkerRegister />
          <PushOptIn />
        </AuthProvider>
      </body>
    </html>
  );
}
