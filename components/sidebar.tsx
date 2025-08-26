"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { 
  Bus, 
  FileBarChart, 
  Wrench, 
  User,
  LogOut,
  Menu,
  X,
  DollarSign,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { cn } from "@/lib/utils";

interface SidebarProps {
  userName: string;
  onLogout: () => void;
}

export function Sidebar({ userName, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t } = useTranslation("common");

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const sidebar = document.getElementById('mobile-sidebar');
      const menuButton = document.getElementById('mobile-menu-button');
      
      if (isMobileMenuOpen && sidebar && menuButton && 
          !sidebar.contains(event.target as Node) && 
          !menuButton.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileMenuOpen]);

  const navigationItems = [
    {
      href: "/dashboard/vehicles",
      icon: Bus,
      label: t("navigation.vehicles"),
      active: pathname === "/dashboard/vehicles"
    },
    {
      href: "/dashboard/maintenance",
      icon: Wrench,
      label: t("navigation.maintenance"),
      active: pathname === "/dashboard/maintenance"
    },
    {
      href: "/dashboard/financials",
      icon: DollarSign,
      label: t("financials:title"),
      active: !!pathname?.startsWith("/dashboard/financials")
    },
    {
      href: "/dashboard/hr",
      icon: Users,
      label: "HR",
      active: !!pathname?.startsWith("/dashboard/hr")
    },
    {
      href: "/dashboard/reports",
      icon: FileBarChart,
      label: t("navigation.reports"),
      active: pathname === "/dashboard/reports"
    }
  ];

  const SidebarContent = () => (
    <>
      <div className="p-4 border-b">
        <div className="flex flex-col items-center justify-center">
          <Image 
            src="/logo.svg" 
            alt={t("company.name")} 
            width={90} 
            height={90} 
            className="mb-2 filter-black" 
            priority
          />
          <span className="text-black font-bold text-lg text-center">{t("company.name")}</span>
        </div>
      </div>
      
      <div className="px-4 py-6 border-b">
        <div className="flex items-center space-x-3">
          <div className="bg-black/10 p-2 rounded-full">
            <User size={20} className="text-black" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{userName}</p>
            <p className="text-xs text-gray-500">{t("company.tagline")}</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4">
        <div className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.label}
                href={item.href} 
                className={cn(
                  "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  item.active 
                    ? "bg-gray-900 text-white" 
                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <Icon
                  className={cn(
                    "mr-3 flex-shrink-0 h-5 w-5",
                    item.active 
                      ? "text-white" 
                      : "text-gray-500 group-hover:text-gray-700"
                  )}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
        
        {/* Language Switcher */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <LanguageSwitcher />
        </div>
      </nav>
      
      <div className="p-4 space-y-3 border-t border-gray-200">
        <button 
          onClick={onLogout}
          className="flex items-center w-full px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <LogOut className="mr-3 h-5 w-5 flex-shrink-0 text-gray-500" />
          <span className="truncate">{t("buttons.logout")}</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        id="mobile-menu-button"
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden bg-white shadow-md hover:bg-gray-50"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? (
          <X className="h-6 w-6 text-black" />
        ) : (
          <Menu className="h-6 w-6 text-black" />
        )}
      </Button>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 bg-white shadow-md flex-col">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-black bg-opacity-50" />
        </div>
      )}

      {/* Mobile Sidebar */}
      <div
        id="mobile-sidebar"
        className={`fixed top-0 left-0 z-50 w-64 h-full bg-white shadow-lg transform transition-transform duration-300 ease-in-out md:hidden ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </div>
    </>
  );
} 