"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { LoginDialog } from "@/components/login-dialog";
import { LogIn } from "lucide-react";

export function Header() {
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  
  return (
    <header className="fixed top-0 left-0 right-0 z-50 py-4 px-6 md:px-12">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <Image 
            src="/logo.svg" 
            alt="Royal Express" 
            width={40} 
            height={40} 
            className="filter" 
            priority
          />
          <span className="font-bold text-2xl text-white">Royal Express</span>
        </Link>
        
        <div className="hidden md:flex items-center">
          <Button 
            className="bg-white text-blue-700 hover:bg-white/90 flex items-center gap-2"
            onClick={() => setShowLoginDialog(true)}
          >
            <LogIn className="h-4 w-4" />
            Log in
          </Button>
        </div>
        
        <div className="md:hidden">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white"
            onClick={() => setShowLoginDialog(true)}
          >
            <LogIn className="h-6 w-6" />
          </Button>
        </div>
      </div>
      
      <LoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} />
    </header>
  );
} 