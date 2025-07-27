"use client";

import { useState, useRef } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, X, FileSpreadsheet, CalendarIcon, Building2, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface BankStatement {
  file: File;
  uploadDate: Date;
  account: "001" | "002";
}

interface VerificationResult {
  dateRange: string;
  totalNetRevenue: number;
  account930508110002Total: number;
  account930508110001Total: number;
  bankTotalDeposits: number;
  status: "verified" | "mismatch";
  difference: number;
  details: string;
}

export default function BankVerificationPage() {
  const { t } = useTranslation('financials');
  const { toast } = useToast();

  // State management
  const [selectedBank, setSelectedBank] = useState<"Caixa Angola" | "BAI" | "">("");
  const [dateFilter, setDateFilter] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday (fixed)
  });
  const [account001Statement, setAccount001Statement] = useState<BankStatement | null>(null);
  const [account002Statement, setAccount002Statement] = useState<BankStatement | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResults, setVerificationResults] = useState<VerificationResult[]>([]);
  const [dragOver001, setDragOver001] = useState(false);
  const [dragOver002, setDragOver002] = useState(false);

  // File input refs
  const account001FileRef = useRef<HTMLInputElement>(null);
  const account002FileRef = useRef<HTMLInputElement>(null);

  // Verification handler
  const handleVerification = async () => {
    // Validation
    if (!selectedBank) {
      toast({
        title: "Bank Required",
        description: t("bankVerification.selectBank"),
        variant: "destructive",
      });
      return;
    }

    if (!dateFilter.from || !dateFilter.to) {
      toast({
        title: "Date Range Required",
        description: t("bankVerification.selectValidDateRange"),
        variant: "destructive",
      });
      return;
    }

    if (!account001Statement || !account002Statement) {
      toast({
        title: "Bank Statements Required",
        description: t("bankVerification.noStatements"),
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);

    try {
      // Create FormData for file uploads
      const formData = new FormData();
      formData.append("bank", selectedBank);
      formData.append("startDate", format(dateFilter.from, "yyyy-MM-dd"));
      formData.append("endDate", format(dateFilter.to, "yyyy-MM-dd"));
      formData.append("account001Statement", account001Statement.file);
      formData.append("account002Statement", account002Statement.file);

      // Call verification API
      const response = await fetch("/api/bank-verification", {
        method: "POST",
        body: formData,
      });

      const responseData = await response.json();

      if (!response.ok) {
        // Handle API error response with detailed information
        console.error("API Error Response:", responseData);
        
        // Extract error details from API response
        const errorMessage = responseData.message || "Verification failed";
        const errorDetails = responseData.details || "";
        const troubleshooting = responseData.troubleshooting || [];
        
        // Show detailed error information
        toast({
          title: responseData.error || "Verification Failed",
          description: `${errorMessage}${errorDetails ? ` ${errorDetails}` : ''}`,
          variant: "destructive",
        });
        
        // Log troubleshooting steps for user reference
        if (troubleshooting.length > 0) {
          console.log("🔧 Troubleshooting Steps:");
          troubleshooting.forEach((step: string, index: number) => {
            console.log(`${index + 1}. ${step}`);
          });
        }
        
        return;
      }

      // Handle successful response
      const results: VerificationResult[] = responseData;
      setVerificationResults(results);

      toast({
        title: "Verification Complete",
        description: `Verified ${results.length} reports against bank statements.`,
      });
    } catch (error) {
      console.error("Network/Parsing error:", error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to verification service. Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // File validation
  const validateFile = (file: File): boolean => {
    const allowedTypes = ["text/csv", "application/vnd.ms-excel", ".csv"];
    const isValidType = file.type === "text/csv" || 
                       file.type === "application/vnd.ms-excel" || 
                       file.name.toLowerCase().endsWith('.csv');
    
    if (!isValidType) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a CSV file.",
        variant: "destructive",
      });
      return false;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit for CSV
      toast({
        title: "File Too Large",
        description: "File size must be less than 5MB.",
        variant: "destructive",
      });
      return false;
    }
    
    return true;
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent, account: "001" | "002") => {
    e.preventDefault();
    if (account === "001") setDragOver001(true);
    else setDragOver002(true);
  };

  const handleDragLeave = (e: React.DragEvent, account: "001" | "002") => {
    e.preventDefault();
    if (account === "001") setDragOver001(false);
    else setDragOver002(false);
  };

  const handleDrop = (e: React.DragEvent, account: "001" | "002") => {
    e.preventDefault();
    if (account === "001") setDragOver001(false);
    else setDragOver002(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0], account);
    }
  };

  // File upload handler
  const handleFileUpload = (file: File, account: "001" | "002") => {
    if (!validateFile(file)) return;

    const bankStatement: BankStatement = {
      file,
      uploadDate: new Date(),
      account,
    };

    if (account === "001") {
      setAccount001Statement(bankStatement);
    } else {
      setAccount002Statement(bankStatement);
    }

    toast({
      title: "File Uploaded",
      description: `Bank statement for Account ${account} uploaded successfully.`,
    });
  };

  // File input change handlers
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>, account: "001" | "002") => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file, account);
    }
  };

  // Remove file handlers
  const removeStatement = (account: "001" | "002") => {
    if (account === "001") {
      setAccount001Statement(null);
      if (account001FileRef.current) account001FileRef.current.value = "";
    } else {
      setAccount002Statement(null);
      if (account002FileRef.current) account002FileRef.current.value = "";
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Get status icon
  const getStatusIcon = (status: VerificationResult["status"]) => {
    switch (status) {
      case "verified":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "mismatch":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            {t("bankVerification.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("bankVerification.description")}
          </p>
        </div>
      </div>

      {/* Placeholder for configuration section */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>Select bank and date range for verification</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Bank Selection */}
            <div className="space-y-2">
              <Label>{t("bankVerification.selectBank")}</Label>
              <Select value={selectedBank} onValueChange={(value: "Caixa Angola" | "BAI") => setSelectedBank(value)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("bankVerification.selectBank")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Caixa Angola">Caixa Angola</SelectItem>
                  <SelectItem value="BAI">BAI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Picker */}
            <div className="space-y-2">
              <Label>{t("filters.from")}:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-[140px] justify-start text-left font-normal",
                      !dateFilter.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFilter.from ? format(dateFilter.from, "MMM dd") : t("filters.pickDate")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateFilter.from}
                    onSelect={(date) => setDateFilter(prev => ({ ...prev, from: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>{t("filters.to")} (Fixed):</Label>
              <Button
                variant={"outline"}
                className="w-[140px] justify-start text-left font-normal cursor-default"
                disabled
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFilter.to ? format(dateFilter.to, "MMM dd") : "Yesterday"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Always set to yesterday for latest bank data
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bank Statements Upload */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Account 002 (Cash Deposits) - Show First */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {t("bankVerification.account002")}
            </CardTitle>
            <CardDescription>
              {t("bankVerification.account002Description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!account002Statement ? (
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                  dragOver002 ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                }`}
                onDragOver={(e) => handleDragOver(e, "002")}
                onDragLeave={(e) => handleDragLeave(e, "002")}
                onDrop={(e) => handleDrop(e, "002")}
                onClick={() => account002FileRef.current?.click()}
              >
                <Upload className="h-10 w-10 text-gray-400 mx-auto mb-4" />
                <p className="text-sm text-gray-600 mb-2">
                  Drag & drop bank statement CSV here or click to upload
                </p>
                <p className="text-xs text-gray-500">CSV files only, max 5MB</p>
                <input
                  ref={account002FileRef}
                  type="file"
                  accept=".csv,text/csv,application/vnd.ms-excel"
                  onChange={(e) => handleFileInputChange(e, "002")}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="font-medium text-sm">{account002Statement.file.name}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(account002Statement.file.size)} • {format(account002Statement.uploadDate, "MMM dd, yyyy HH:mm")}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStatement("002")}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account 001 (TPA/POS) - Show Second */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {t("bankVerification.account001")}
            </CardTitle>
            <CardDescription>
              {t("bankVerification.account001Description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!account001Statement ? (
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                  dragOver001 ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                }`}
                onDragOver={(e) => handleDragOver(e, "001")}
                onDragLeave={(e) => handleDragLeave(e, "001")}
                onDrop={(e) => handleDrop(e, "001")}
                onClick={() => account001FileRef.current?.click()}
              >
                <Upload className="h-10 w-10 text-gray-400 mx-auto mb-4" />
                <p className="text-sm text-gray-600 mb-2">
                  Drag & drop bank statement CSV here or click to upload
                </p>
                <p className="text-xs text-gray-500">CSV files only, max 5MB</p>
                <input
                  ref={account001FileRef}
                  type="file"
                  accept=".csv,text/csv,application/vnd.ms-excel"
                  onChange={(e) => handleFileInputChange(e, "001")}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="font-medium text-sm">{account001Statement.file.name}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(account001Statement.file.size)} • {format(account001Statement.uploadDate, "MMM dd, yyyy HH:mm")}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStatement("001")}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>


      </div>

      {/* Verify Button */}
      <div className="flex justify-center">
        <Button
          onClick={handleVerification}
          disabled={isVerifying || !selectedBank || !dateFilter.from || !dateFilter.to || !account001Statement || !account002Statement}
          className="bg-black hover:bg-gray-800 text-white px-8 py-2"
        >
          {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isVerifying ? t("bankVerification.processing") : t("bankVerification.verifyDeposits")}
        </Button>
      </div>

      {/* Verification Results */}
      {verificationResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("bankVerification.verificationResults")}</CardTitle>
            <CardDescription>
              Total verification results for selected date range
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {verificationResults.map((result, index) => (
                <div key={index} className="space-y-4">
                  {/* Summary Header */}
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold mb-3">Verification Summary</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                      <div className="bg-blue-100 p-3 rounded">
                        <p className="text-sm text-blue-600">Daily Reports NET Revenue</p>
                        <p className="text-xl font-bold text-blue-800">AOA {result.totalNetRevenue.toLocaleString()}</p>
                        <p className="text-xs text-blue-600">({result.dateRange})</p>
                      </div>
                      <div className="bg-green-100 p-3 rounded">
                        <p className="text-sm text-green-600">Bank Statements Total</p>
                        <p className="text-xl font-bold text-green-800">AOA {result.bankTotalDeposits.toLocaleString()}</p>
                        <p className="text-xs text-green-600">Account 001 + Account 002</p>
                      </div>
                      <div className={`p-3 rounded ${result.status === 'verified' ? 'bg-green-100' : 'bg-red-100'}`}>
                        <p className={`text-sm ${result.status === 'verified' ? 'text-green-600' : 'text-red-600'}`}>Status</p>
                        <p className={`text-xl font-bold ${result.status === 'verified' ? 'text-green-800' : 'text-red-800'}`}>
                          {result.status === 'verified' ? '✅ VERIFIED' : '❌ MISMATCH'}
                        </p>
                        <p className={`text-xs ${result.status === 'verified' ? 'text-green-600' : 'text-red-600'}`}>
                          {result.difference === 0 ? 'Perfect Match' : `Diff: ${Math.abs(result.difference).toLocaleString()} AOA`}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Detailed Breakdown */}
                  <div className="flex items-center gap-4 p-4 border rounded-lg">
                    {getStatusIcon(result.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">Detailed Breakdown</span>
                        <Badge variant={result.status === "verified" ? "default" : "destructive"}>
                          {result.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Net Revenue</p>
                          <p className="font-medium">AOA {result.totalNetRevenue.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Account 930508110002 (Cash)</p>
                          <p className="font-medium">AOA {result.account930508110002Total.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Account 930508110001 (TPA)</p>
                          <p className="font-medium">AOA {result.account930508110001Total.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Bank Total</p>
                          <p className="font-medium">AOA {result.bankTotalDeposits.toLocaleString()}</p>
                        </div>
                      </div>
                      {result.difference !== 0 && (
                        <div className="mt-2 p-2 bg-yellow-50 rounded text-sm">
                          <p className="text-yellow-800">
                            Difference: AOA {Math.abs(result.difference).toLocaleString()} 
                            {result.difference > 0 ? " (Bank has more)" : " (Revenue has more)"}
                          </p>
                        </div>
                      )}
                      <p className="text-sm text-gray-600 mt-2">{result.details}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 