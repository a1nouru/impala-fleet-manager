"use client";

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
          <div className="space-y-8">
            {deposits.map((deposit) => (
              <div key={deposit.id} className="flex items-center">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>
                    {deposit.created_by?.substring(0, 2).toUpperCase() || '??'}
                  </AvatarFallback>
                </Avatar>
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {deposit.created_by || "Unknown User"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(deposit.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="ml-auto font-medium">
                  +{formatCurrency(deposit.amount)}
                </div>
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