"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";

export function LoginDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { signIn, signUp, signInWithMagicLink, resetPassword, isAuthenticated, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [tab, setTab] = useState<"login" | "signup" | "magic" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [hasShownSuccessToast, setHasShownSuccessToast] = useState(false);

  // SIMPLIFIED: Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      console.log('🔓 Login dialog opened');
      setError("");
      setMagicLinkSent(false);
      setResetEmailSent(false);
      setHasShownSuccessToast(false);
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, [open]);

  // SIMPLIFIED: Monitor authentication success
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
      
      if (result?.session) {
        console.log('✅ Login successful');
      } else {
        throw new Error('Login failed - no session created');
      }
    } catch (error: unknown) {
      console.error("Authentication error:", error);
      setError(error instanceof Error ? error.message : "An unexpected error occurred");
      setIsLoading(false);
    }
    // Note: Don't set loading to false here - let the auth state change handle it
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (!email || !password) {
        setError("Email and password are required");
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }

      await signUp(email, password);
      
      toast({
        title: "Account created successfully",
        description: "Please check your email to confirm your account",
        variant: "default",
      });
      
      setTab("login");
    } catch (error: unknown) {
      console.error("Sign up error:", error);
      setError(error instanceof Error ? error.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLinkSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (!email) {
        setError("Email is required");
        return;
      }

      await signInWithMagicLink(email);
      setMagicLinkSent(true);
      
      toast({
        title: "Magic link sent",
        description: "Please check your email for the login link",
        variant: "default",
      });
    } catch (error: unknown) {
      console.error("Magic link error:", error);
      setError(error instanceof Error ? error.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (!email) {
        setError("Email is required");
        return;
      }

      await resetPassword(email);
      setResetEmailSent(true);
      
      toast({
        title: "Password reset email sent",
        description: "Please check your email for the password reset link",
        variant: "default",
      });
    } catch (error: unknown) {
      console.error("Password reset error:", error);
      setError(error instanceof Error ? error.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader className="flex flex-row justify-between items-center">
          <DialogTitle className="text-2xl font-bold text-blue-700">
            {tab === "login" && "Login"}
            {tab === "signup" && "Sign Up"}
            {tab === "magic" && "Magic Link Login"}
            {tab === "reset" && "Reset Password"}
          </DialogTitle>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <Tabs value={tab} onValueChange={(value) => setTab(value as "login" | "signup" | "magic" | "reset")} className="mt-2">
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
            <TabsTrigger value="magic">Magic Link</TabsTrigger>
            <TabsTrigger value="reset">Reset</TabsTrigger>
          </TabsList>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-md">
              {error}
            </div>
          )}
          
          <TabsContent value="login">
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
          </TabsContent>
          
          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="py-2 space-y-4">
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
              <Input 
                type="password" 
                placeholder="Confirm Password" 
                className="h-12"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <Button 
                type="submit" 
                className="w-full mt-4 h-12 bg-blue-600 text-white hover:bg-blue-700" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Sign up"
                )}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="magic">
            {magicLinkSent ? (
              <div className="py-4 text-center">
                <p className="text-green-600 mb-4">Magic link sent to your email!</p>
                <p className="text-sm text-gray-600">Check your inbox and click the link to sign in.</p>
              </div>
            ) : (
              <form onSubmit={handleMagicLinkSignIn} className="py-2 space-y-4">
                <Input 
                  type="email" 
                  placeholder="Email" 
                  className="h-12"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Button 
                  type="submit" 
                  className="w-full mt-4 h-12 bg-blue-600 text-white hover:bg-blue-700" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending magic link...
                    </>
                  ) : (
                    "Send magic link"
                  )}
                </Button>
              </form>
            )}
          </TabsContent>
          
          <TabsContent value="reset">
            {resetEmailSent ? (
              <div className="py-4 text-center">
                <p className="text-green-600 mb-4">Password reset email sent!</p>
                <p className="text-sm text-gray-600">Check your inbox and follow the instructions to reset your password.</p>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="py-2 space-y-4">
                <Input 
                  type="email" 
                  placeholder="Email" 
                  className="h-12"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Button 
                  type="submit" 
                  className="w-full mt-4 h-12 bg-blue-600 text-white hover:bg-blue-700" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending reset email...
                    </>
                  ) : (
                    "Reset password"
                  )}
                </Button>
              </form>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
} 