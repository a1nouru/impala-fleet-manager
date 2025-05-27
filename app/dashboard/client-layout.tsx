"use client";

import React, { Suspense, useEffect, useState } from 'react'
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/protected-route";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

// Loading component for content area
function ContentLoadingFallback() {
  return (
    <div className="flex-1 h-full flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
        <p className="text-gray-600 text-lg">Loading dashboard content...</p>
      </div>
    </div>
  );
}

export function DashboardLayoutClient({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  
  // Simulate preloading common resources
  useEffect(() => {
    const preloadResources = async () => {
      // Set a short timeout to allow the UI to render first
      setTimeout(() => {
        setIsLoading(false);
      }, 100);
    };
    
    preloadResources();
  }, []);
  
  const handleLogout = async () => {
    try {
      console.log('🚪 Initiating logout...');
      
      // Show loading state
      toast({
        title: "Signing out...",
        description: "Please wait while we sign you out",
      });
      
      await signOut();
      
      // Show success message
      toast({
        title: "Signed out successfully",
        description: "You have been logged out",
        variant: "default",
      });
      
      console.log('✅ Logout completed');
      router.push("/");
    } catch (error) {
      console.error("Error logging out:", error);
      
      // Show error message
      toast({
        title: "Logout error",
        description: "There was an issue signing you out. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-gray-100">
        <Sidebar 
          userName={user?.email?.split('@')[0] || "User"} 
          onLogout={handleLogout} 
        />
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <ContentLoadingFallback />
          ) : (
            <Suspense fallback={<ContentLoadingFallback />}>
              {children}
            </Suspense>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
} 