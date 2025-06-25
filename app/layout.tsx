import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/use-toast";
import { AuthProvider } from "@/context/AuthContext";
import { DebugEnvironment } from "./debug-env";
import { AuthDebug } from "@/components/auth-debug";
import { I18nProvider } from "@/components/I18nProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Royal Express - Fleet Management System (Internal)",
  description: "Internal tool for managing bus fleet, tracking maintenance, and monitoring spare parts inventory.",
  icons: {
    icon: [
      {
        url: '/favicon.svg',
        href: '/favicon.svg',
      }
    ]
  }
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
          {/* Temporary debug component - remove after fixing auth issues */}
          <AuthDebug enabled={process.env.NODE_ENV === 'development'} />
        </AuthProvider>
        <DebugEnvironment />
      </body>
    </html>
  );
}
