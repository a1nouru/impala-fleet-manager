'use client';

import { Loader2 } from "lucide-react";

export function DashboardLoader() {
  return (
    <div className="flex-1 h-full flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
        <p className="text-gray-600 text-lg">Loading dashboard content...</p>
      </div>
    </div>
  );
} 