"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/use-toast";

export function LoginDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { signIn, isAuthenticated, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasShownSuccessToast, setHasShownSuccessToast] = useState(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      console.log('🔓 Login dialog opened');
      setError("");
      setHasShownSuccessToast(false);
      setIsLoading(false);
      setEmail("");
      setPassword("");
    } else {
      setIsLoading(false);
    }
  }, [open]);

  // Monitor authentication success
  useEffect(() => {
    if (isAuthenticated && !authLoading && !hasShownSuccessToast) {
      console.log('🎉 Authentication successful - closing dialog and redirecting');
      onOpenChange(false);
      
      toast({
        title: "Login successful",
        description: "Welcome back!",
        variant: "default",
      });
      
      setHasShownSuccessToast(true);
      router.push("/dashboard/maintenance");
    }
  }, [isAuthenticated, authLoading, hasShownSuccessToast, onOpenChange, router, toast]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Simple validation
      if (!email || !password) {
        setError("Email and password are required");
        return;
      }

      console.log('🔐 Attempting login...');
      const result = await signIn(email, password);
      
      if (result?.data?.session) {
        console.log('✅ Login successful');
      } else if (result?.error) {
        throw new Error(result.error.message || 'Login failed');
      } else {
        throw new Error('Login failed - no session created');
      }
    } catch (error: unknown) {
      console.error("Authentication error:", error);
      setError(error instanceof Error ? error.message : "An unexpected error occurred");
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader className="flex flex-row justify-between items-center">
          <DialogTitle className="text-2xl font-bold text-blue-700">
            Login
          </DialogTitle>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-md">
            {error}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="py-2 space-y-4">
          <Input 
            type="email" 
            placeholder="Email" 
            className="h-12"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input 
            type="password" 
            placeholder="Password" 
            className="h-12"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button 
            type="submit" 
            className="w-full mt-4 h-12 bg-blue-600 text-white hover:bg-blue-700" 
            disabled={isLoading || authLoading}
          >
            {isLoading || authLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {authLoading ? "Checking authentication..." : "Logging in..."}
              </>
            ) : (
              "Log in"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
} 