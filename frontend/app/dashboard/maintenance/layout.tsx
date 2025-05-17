import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Maintenance | Royal Express Fleet Manager",
  description: "Manage vehicle maintenance records and schedules",
}

export default function MaintenanceLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <section className="w-full h-full">
      {children}
    </section>
  )
} 