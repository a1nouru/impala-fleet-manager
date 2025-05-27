"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { prepareForLogin, detectAuthConflicts } from "@/utils/authUtils";
import { runAuthDiagnostics, fixAuthIssues } from "@/utils/authDiagnostics";

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
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [showRetry, setShowRetry] = useState(false);
  const [diagnosticsRun, setDiagnosticsRun] = useState(false);

  // Prepare browser for login when dialog opens
  useEffect(() => {
    if (open) {
      console.log('🔓 Login dialog opened - preparing browser...');
      
      // Check for auth conflicts and clear if needed
      const hasConflicts = detectAuthConflicts();
      if (hasConflicts) {
        prepareForLogin();
      }
      
      // Reset state
      setLoginAttempts(0);
      setShowRetry(false);
      setError("");
      setDiagnosticsRun(false);
    }
  }, [open]);

  // Monitor authentication state changes
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      console.log('🎉 Authentication successful - closing dialog and redirecting');
      onOpenChange(false);
      
      // Small delay to ensure state is fully updated
      setTimeout(() => {
        router.push("/dashboard/maintenance");
      }, 100);
    }
  }, [isAuthenticated, authLoading, onOpenChange, router]);

  // Handle stuck authentication after multiple attempts
  useEffect(() => {
    if (loginAttempts >= 2 && !isAuthenticated && !isLoading && !diagnosticsRun) {
      console.log('⚠️ Multiple login attempts detected, running diagnostics...');
      setShowRetry(true);
      
      // Run diagnostics automatically
      runAuthDiagnostics().then(() => {
        setDiagnosticsRun(true);
      });
    }
  }, [loginAttempts, isAuthenticated, isLoading, diagnosticsRun]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    setLoginAttempts(prev => prev + 1);

    try {
      // Simple validation
      if (!email || !password) {
        setError("Email and password are required");
        setIsLoading(false);
        return;
      }

      console.log(`🔐 Login attempt #${loginAttempts + 1}`);
      const result = await signIn(email, password);
      
      if (result?.session) {
        console.log('✅ Login successful, session created');
        
        toast({
          title: "Logged in successfully",
          description: "Welcome back to Royal Express Fleet Manager",
          variant: "default",
        });
        
        // Wait a moment for auth state to update
        setTimeout(() => {
          if (!isAuthenticated) {
            console.log('⚠️ Auth state not updated, forcing refresh...');
            window.location.reload();
          }
        }, 1000);
      } else {
        throw new Error('No session returned from login');
      }
    } catch (error: unknown) {
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryLogin = async () => {
    console.log('🔄 Retrying login with fresh browser state...');
    
    setIsLoading(true);
    
    try {
      // Run diagnostics and fix issues
      await fixAuthIssues();
      
      // Clear everything and start fresh
      prepareForLogin();
      setLoginAttempts(0);
      setShowRetry(false);
      setError("");
      setDiagnosticsRun(false);
      
      toast({
        title: "Browser state refreshed",
        description: "Please try logging in again",
        variant: "default",
      });
    } catch (error) {
      console.error('Error during retry:', error);
      
      // If all else fails, force a page reload
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Simple validation
      if (!email || !password) {
        setError("Email and password are required");
        setIsLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match");
        setIsLoading(false);
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
      handleError(error);
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
        setIsLoading(false);
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
      handleError(error);
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
        setIsLoading(false);
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
      handleError(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle error display
  const handleError = (error: unknown) => {
    console.error("Authentication error:", error);
    setError(error instanceof Error ? error.message : "An unexpected error occurred");
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

          {showRetry && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-yellow-800 text-sm mb-2">
                Login seems to be stuck? Try refreshing your browser session.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRetryLogin}
                className="text-yellow-700 border-yellow-300 hover:bg-yellow-100"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh & Retry
              </Button>
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
              
              {loginAttempts > 0 && (
                <p className="text-xs text-gray-500 text-center">
                  Attempt {loginAttempts} of 3
                </p>
              )}
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
                  "Sign Up"
                )}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="magic">
            {!magicLinkSent ? (
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
                    "Send Magic Link"
                  )}
                </Button>
              </form>
            ) : (
              <div className="py-4 text-center">
                <p className="mb-4">Magic link has been sent to your email.</p>
                <p className="text-sm text-gray-500">Check your inbox and click the link to log in.</p>
                <Button 
                  type="button" 
                  className="mt-4" 
                  variant="outline"
                  onClick={() => {
                    setMagicLinkSent(false);
                    setEmail("");
                  }}
                >
                  Send another link
                </Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="reset">
            {!resetEmailSent ? (
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
                    "Reset Password"
                  )}
                </Button>
              </form>
            ) : (
              <div className="py-4 text-center">
                <p className="mb-4">Password reset email has been sent.</p>
                <p className="text-sm text-gray-500">Check your inbox and follow the instructions to reset your password.</p>
                <Button 
                  type="button" 
                  className="mt-4" 
                  variant="outline"
                  onClick={() => {
                    setResetEmailSent(false);
                    setEmail("");
                  }}
                >
                  Send another email
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
} 