"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { financialService } from "@/services/financialService";
import { Loader2 } from "lucide-react";
import { toast } from "./ui/use-toast";

interface Deposit {
  id: string;
  amount: number;
  created_by: string;
  created_at: string;
}

const formatCurrency = (value: number) => {
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: "AOA",
    });
};

export function RecentDeposits() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDeposits = async () => {
      try {
        setIsLoading(true);
        const data = await financialService.getRecentDeposits();
        setDeposits(data);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load recent deposits.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false);
      }
    };

    fetchDeposits();
  }, []);

  if (isLoading) {
    return (
        <Card className="col-span-3">
            <CardHeader>
                <CardTitle>Recent Deposits</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[350px] w-full flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </CardContent>
        </Card>
    )
  }

  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle>Recent Deposits</CardTitle>
      </CardHeader>
      <CardContent>
        {deposits.length > 0 ? (
          <div className="divide-y">
            {deposits.slice(0, 5).map((deposit) => (
              <div key={deposit.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium leading-none">
                    {new Date(deposit.created_at).toLocaleDateString()}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {deposit.created_by?.split("@")[0] || "Unknown user"}
                  </p>
                </div>
                <span className="text-sm font-semibold">
                  +{formatCurrency(deposit.amount)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-[350px] flex items-center justify-center">
            <p className="text-muted-foreground">No recent deposits found.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 