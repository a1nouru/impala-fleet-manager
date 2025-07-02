"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { financialService, DailyReport } from "@/services/financialService";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const AGASEKE_PLATES = ["LDA-25-91-AD", "LDA-25-92-AD", "LDA-25-93-AD"];

interface AgasekeReportProps {
  dateRange: DateRange | undefined;
}

export function AgasekeReport({ dateRange }: AgasekeReportProps) {
  const [agasekeReports, setAgasekeReports] = useState<DailyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAgasekeData = async () => {
      if (!dateRange?.from || !dateRange?.to) return;
      
      try {
        setIsLoading(true);
        // This fetches all reports, we will filter them on the client-side for simplicity.
        // For larger datasets, a dedicated DB function would be better.
        const allReports = await financialService.getDailyReports(); 
        
        const filtered = allReports.filter(report => {
          const reportDate = new Date(report.report_date);
          const isAgaseke = report.vehicles?.plate && AGASEKE_PLATES.includes(report.vehicles.plate);
          const inRange = reportDate >= dateRange.from! && reportDate <= dateRange.to!;
          return isAgaseke && inRange;
        });
        
        setAgasekeReports(filtered);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load Agaseke Fund report data.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAgasekeData();
  }, [dateRange]);

  const totalAgasekeRevenue = agasekeReports.reduce((sum, report) => 
    sum + (report.ticket_revenue || 0) + (report.baggage_revenue || 0) + (report.cargo_revenue || 0), 0);

  return (
    <Card className="col-span-7">
      <CardHeader>
        <CardTitle>Agaseke Fund Vehicle Report</CardTitle>
        <CardDescription>
          Financial summary for Agaseke vehicles for the selected period.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-40 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Vehicle Plate</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agasekeReports.length > 0 ? (
                agasekeReports.map(report => (
                  <TableRow key={report.id}>
                    <TableCell>{format(new Date(report.report_date), "PPP")}</TableCell>
                    <TableCell>{report.vehicles?.plate}</TableCell>
                    <TableCell className="text-right">
                      {((report.ticket_revenue || 0) + (report.baggage_revenue || 0) + (report.cargo_revenue || 0)).toLocaleString("en-US", { style: "currency", currency: "AOA" })}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-24">
                    No data for Agaseke vehicles in this period.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {agasekeReports.length > 0 && (
              <TableFooter>
                <TableRow className="font-bold">
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-right">
                    {totalAgasekeRevenue.toLocaleString("en-US", {
                      style: "currency",
                      currency: "AOA",
                    })}
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        )}
      </CardContent>
    </Card>
  );
} 