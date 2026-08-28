"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Loader2, MailCheck, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/use-toast";

type View = "login" | "forgot" | "sent";

export function LoginDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { signIn, resetPassword, isAuthenticated, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasShownSuccessToast, setHasShownSuccessToast] = useState(false);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      console.log('🔓 Login dialog opened');
      setView("login");
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

  const handleSendResetLink = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Enter your account email first");
      return;
    }

    setIsLoading(true);
    try {
      const result = await resetPassword(email);
      if (result?.error) {
        throw new Error(result.error.message || "Could not send the reset link");
      }
      setView("sent");
    } catch (error: unknown) {
      console.error("Password reset error:", error);
      setError(error instanceof Error ? error.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const switchView = (next: View) => {
    setError("");
    setView(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader className="flex flex-row justify-between items-center">
          <DialogTitle className="text-2xl font-bold text-blue-700">
            {view === "login" ? "Login" : view === "forgot" ? "Reset password" : "Check your email"}
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

        {view === "login" && (
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
            <button
              type="button"
              onClick={() => switchView("forgot")}
              className="block w-full text-center text-sm text-blue-600 hover:underline"
            >
              Forgot your password?
            </button>
          </form>
        )}

        {view === "forgot" && (
          <form onSubmit={handleSendResetLink} className="py-2 space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your account email and we&apos;ll send you a link to set a new password.
            </p>
            <Input
              type="email"
              placeholder="Email"
              className="h-12"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
            <Button
              type="submit"
              className="w-full mt-2 h-12 bg-blue-600 text-white hover:bg-blue-700"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending link...
                </>
              ) : (
                "Send reset link"
              )}
            </Button>
            <button
              type="button"
              onClick={() => switchView("login")}
              className="flex w-full items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to login
            </button>
          </form>
        )}

        {view === "sent" && (
          <div className="py-2 space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
              <MailCheck className="h-7 w-7 text-green-600" />
            </div>
            <p className="text-sm text-muted-foreground">
              If an account exists for <span className="font-medium text-foreground">{email}</span>,
              a password reset link is on its way. Open it on this device to set a new password.
            </p>
            <Button
              type="button"
              className="w-full h-12 bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => switchView("login")}
            >
              Back to login
            </Button>
            <button
              type="button"
              onClick={() => switchView("forgot")}
              className="block w-full text-center text-sm text-muted-foreground hover:text-foreground"
            >
              Didn&apos;t get the email? Send it again
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
