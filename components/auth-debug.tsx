"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { runAuthDiagnostics, startAuthMonitoring } from '@/utils/authDiagnostics';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface AuthDebugProps {
  enabled?: boolean;
}

export function AuthDebug({ enabled = false }: AuthDebugProps) {
  const { user, session, loading, isAuthenticated } = useAuth();
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [monitoring, setMonitoring] = useState(false);

  useEffect(() => {
    if (enabled && !monitoring) {
      startAuthMonitoring();
      setMonitoring(true);
    }
  }, [enabled, monitoring]);

  const runDiagnostics = async () => {
    const result = await runAuthDiagnostics();
    setDiagnostics(result);
  };

  if (!enabled) return null;

  return (
    <Card className="fixed bottom-4 right-4 w-80 max-h-96 overflow-auto z-50 bg-white shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          🔍 Auth Debug
          <Button size="sm" variant="outline" onClick={runDiagnostics}>
            Run Diagnostics
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <strong>Loading:</strong>
            <Badge variant={loading ? "destructive" : "default"} className="ml-1">
              {loading ? "Yes" : "No"}
            </Badge>
          </div>
          <div>
            <strong>Authenticated:</strong>
            <Badge variant={isAuthenticated ? "default" : "destructive"} className="ml-1">
              {isAuthenticated ? "Yes" : "No"}
            </Badge>
          </div>
          <div>
            <strong>User:</strong>
            <Badge variant={user ? "default" : "secondary"} className="ml-1">
              {user ? "Present" : "None"}
            </Badge>
          </div>
          <div>
            <strong>Session:</strong>
            <Badge variant={session ? "default" : "secondary"} className="ml-1">
              {session ? "Present" : "None"}
            </Badge>
          </div>
        </div>

        {user && (
          <div className="mt-2 p-2 bg-gray-50 rounded">
            <div><strong>Email:</strong> {user.email}</div>
            <div><strong>ID:</strong> {user.id?.slice(0, 8)}...</div>
          </div>
        )}

        {diagnostics && (
          <div className="mt-2 p-2 bg-blue-50 rounded">
            <div><strong>Diagnostics:</strong></div>
            <div>Storage Keys: {diagnostics.storage.supabaseKeys?.length || 0}</div>
            <div>Conflicts: {diagnostics.storage.hasConflicts ? "Yes" : "No"}</div>
            {diagnostics.recommendations.length > 0 && (
              <div className="mt-1">
                <strong>Issues:</strong>
                {diagnostics.recommendations.map((rec: any, i: number) => (
                  <div key={i} className="text-red-600">
                    • {rec.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="text-gray-500 text-xs">
          Monitoring: {monitoring ? "Active" : "Inactive"}
        </div>
      </CardContent>
    </Card>
  );
} 