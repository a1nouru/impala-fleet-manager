import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KeyRound } from "lucide-react";

export default function AuthCodeErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <KeyRound className="h-7 w-7 text-red-500" />
          </div>
          <CardTitle>Sign-in link expired</CardTitle>
          <CardDescription>
            This link is invalid, expired, or has already been used. Go back to the
            login screen and request a new one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full h-12 bg-blue-600 text-white hover:bg-blue-700">
            <Link href="/">Back to login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
