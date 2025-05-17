"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { LoginDialog } from "@/components/login-dialog";
import { LogIn } from "lucide-react";

export function HeroSection() {
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  
  return (
    <section className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-600 to-blue-800 z-0" />
      
      {/* Animated circle */}
      <motion.div 
        className="absolute w-[800px] h-[800px] border border-white/20 rounded-full z-10"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
      />
      
      <div className="container mx-auto px-4 z-20 flex flex-col lg:flex-row items-center justify-between gap-12">
        {/* Text content */}
        <motion.div 
          className="text-center lg:text-left"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            Manage our fleet <br />
            with precision
          </h1>
          <p className="text-xl text-white/80 mb-8 max-w-lg">
            Track vehicle maintenance, manage spare parts inventory, and monitor repair costs
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <Button 
              size="lg" 
              className="bg-white text-blue-700 hover:bg-white/90 text-lg px-8 py-6 rounded-full flex items-center gap-2"
              onClick={() => setShowLoginDialog(true)}
            >
              <LogIn className="h-5 w-5" />
              Log in to system
            </Button>
          </div>
        </motion.div>
        
        {/* Image */}
        <motion.div
          className="relative w-full max-w-md lg:max-w-lg"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
        >
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 shadow-lg">
            <div className="rounded-lg overflow-hidden">
              <div className="h-64 bg-blue-400/30 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                  <path d="M3 9h13l1-2h3a2 2 0 0 1 2 2v2M8 16H3c-.6 0-1-.4-1-1V8c0-.6.4-1 1-1h1" />
                  <path d="M9 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                  <path d="M21 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                </svg>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
      
      <LoginDialog open={showLoginDialog} onOpenChange={setShowLoginDialog} />
    </section>
  );
} 