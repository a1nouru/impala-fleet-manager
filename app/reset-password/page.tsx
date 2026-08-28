"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, KeyRound, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/use-toast";

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordPage() {
  const router = useRouter();
  const { user, loading, updatePassword } = useAuth();
  const { toast } = useToast();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState("");

  const tooShort = newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    newPassword.length >= MIN_PASSWORD_LENGTH && newPassword === confirmPassword && !isSaving;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;

    setError("");
    setIsSaving(true);
    try {
      const result = await updatePassword(newPassword);
      if (result?.error) {
        throw new Error(result.error.message || "Could not update the password");
      }
      setIsDone(true);
      toast({ title: "Password updated", description: "You are now logged in." });
      setTimeout(() => router.replace("/dashboard/maintenance"), 1500);
    } catch (err: unknown) {
      console.error("Password update error:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        {loading ? (
          <CardContent className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        ) : !user ? (
          // No recovery session: the email link is missing, expired, or already used.
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                <KeyRound className="h-7 w-7 text-red-500" />
              </div>
              <CardTitle>Reset link expired</CardTitle>
              <CardDescription>
                This password reset link is invalid, expired, or has already been used.
                Request a new one from the login screen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full h-12 bg-blue-600 text-white hover:bg-blue-700">
                <Link href="/">Back to login</Link>
              </Button>
            </CardContent>
          </>
        ) : isDone ? (
          <>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <CardTitle>Password updated</CardTitle>
              <CardDescription>Taking you to your dashboard…</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center pb-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Set a new password</CardTitle>
              <CardDescription>
                Choose a new password for <span className="font-medium">{user.email}</span>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-md">{error}</div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      className="h-12 pr-10"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoFocus
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className={`text-xs ${tooShort ? "text-red-600" : "text-muted-foreground"}`}>
                    At least {MIN_PASSWORD_LENGTH} characters.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    className="h-12"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  {mismatch && <p className="text-xs text-red-600">Passwords don&apos;t match.</p>}
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 bg-blue-600 text-white hover:bg-blue-700"
                  disabled={!canSubmit}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating password...
                    </>
                  ) : (
                    "Update password"
                  )}
                </Button>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
