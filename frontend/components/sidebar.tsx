"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { 
  Bus, 
  FileBarChart, 
  Package, 
  Settings, 
  Wrench, 
  User,
  LogOut
} from "lucide-react";

interface SidebarProps {
  userName: string;
  onLogout: () => void;
}

export function Sidebar({ userName, onLogout }: SidebarProps) {
  const pathname = usePathname();
  
  return (
    <div className="w-64 bg-white shadow-md flex flex-col">
      <div className="p-4 border-b">
        <div className="flex flex-col items-center justify-center">
          <Image 
            src="/logo.svg" 
            alt="Royal Express" 
            width={90} 
            height={90} 
            className="mb-2 filter-black" 
            priority
          />
          <span className="text-black font-bold text-lg">Royal Express</span>
        </div>
      </div>
      
      <div className="px-4 py-6 border-b">
        <div className="flex items-center space-x-3">
          <div className="bg-black/10 p-2 rounded-full">
            <User size={20} className="text-black" />
          </div>
          <div>
            <p className="text-sm font-medium">{userName}</p>
            <p className="text-xs text-gray-500">Fleet Manager</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4">
        <div className="space-y-1">
          <Link 
            href="/dashboard/vehicles" 
            className={`flex items-center w-full px-3 py-2 text-sm font-medium rounded-md ${
              pathname === "/dashboard/vehicles" 
                ? "bg-black/10 text-black" 
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Bus className="mr-3 h-5 w-5" />
            Vehicles
          </Link>
          
          <button className="flex items-center w-full px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100">
            <Package className="mr-3 h-5 w-5" />
            Inventory
          </button>
          
          <Link 
            href="/dashboard/maintenance" 
            className={`flex items-center w-full px-3 py-2 text-sm font-medium rounded-md ${
              pathname === "/dashboard/maintenance" 
                ? "bg-black/10 text-black" 
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Wrench className="mr-3 h-5 w-5" />
            Maintenance
          </Link>
          
          <Link 
            href="/dashboard/reports" 
            className={`flex items-center w-full px-3 py-2 text-sm font-medium rounded-md ${
              pathname === "/dashboard/reports" 
                ? "bg-black/10 text-black" 
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <FileBarChart className="mr-3 h-5 w-5" />
            Reports
          </Link>
          
          <button className="flex items-center w-full px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100">
            <Settings className="mr-3 h-5 w-5" />
            Settings
          </button>
        </div>
      </nav>
      
      <div className="p-4 border-t">
        <button 
          onClick={onLogout}
          className="flex items-center w-full px-3 py-2 text-sm font-medium rounded-md text-black hover:bg-gray-100"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Logout
        </button>
      </div>
    </div>
  );
} 