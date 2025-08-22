"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, PlusCircle, Edit, CalendarIcon, Filter, Car, Receipt, Eye, Trash2, ChevronDown, ChevronRight, DollarSign } from "lucide-react";
import { rentalService } from "@/services/rentalService";
import { vehicleService } from "@/services/vehicleService";
import { toast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, isToday, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { VehicleRental } from "@/services/financialService";
import { CreateRentalDialog } from "@/components/create-rental-dialog";

// Helper function to calculate total expenses
const calculateTotalExpenses = (rental: VehicleRental): number => {
  return (rental.rental_expenses || []).reduce((sum, expense) => sum + expense.amount, 0);
};

// Helper function to calculate net profit
const calculateNetProfit = (rental: VehicleRental): number => {
  const totalExpenses = calculateTotalExpenses(rental);
  return rental.rental_amount - totalExpenses;
};

// Helper function to format currency
const formatCurrency = (value: number) => {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "AOA",
  });
};

// Helper function to format date range
const formatDateRange = (startDate: string, endDate: string) => {
  const start = format(parseISO(startDate), "MMM dd");
  const end = format(parseISO(endDate), "MMM dd, yyyy");
  return `${start} - ${end}`;
};

// Helper function to calculate rental duration in days
const calculateDuration = (startDate: string, endDate: string) => {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Group rentals by date
const groupRentalsByDate = (rentals: VehicleRental[]) => {
  const grouped = rentals.reduce((acc, rental) => {
    const date = format(parseISO(rental.rental_start_date), "yyyy-MM-dd");
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(rental);
    return acc;
  }, {} as Record<string, VehicleRental[]>);

  return Object.entries(grouped).map(([date, rentals]) => ({
    date,
    rentals,
    totalRevenue: rentals.reduce((sum, r) => sum + r.rental_amount, 0),
    totalExpenses: rentals.reduce((sum, r) => sum + calculateTotalExpenses(r), 0),
    netProfit: rentals.reduce((sum, r) => sum + calculateNetProfit(r), 0),
    rentalCount: rentals.length,
    vehicleCount: rentals.reduce((sum, r) => sum + (r.rental_vehicles?.length || 0), 0),
  })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export default function RentalPage() {
  const { user } = useAuth();
  const { t } = useTranslation('financials');
  const [rentals, setRentals] = useState<VehicleRental[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [rentalToDelete, setRentalToDelete] = useState<VehicleRental | null>(null);
  const [selectedRental, setSelectedRental] = useState<VehicleRental | null>(null);
  const [showRentalDetails, setShowRentalDetails] = useState(false);
  const [expandedDates, setExpandedDates] = useState<string[]>([]);

  // Filter states
  const [dateFilter, setDateFilter] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1), // First day of current month
    to: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), // Last day of current month
  });
  const [clientFilter, setClientFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [groupByDate, setGroupByDate] = useState(true);
  const [vehiclePlateFilter, setVehiclePlateFilter] = useState<string>("all");
  const [availableVehicles, setAvailableVehicles] = useState<Array<{id: string, plate: string}>>([]);

  // Summary state
  const [summary, setSummary] = useState({
    total_revenue: 0,
    total_expenses: 0,
    net_profit: 0,
    rental_count: 0,
    vehicle_count: 0,
  });

  const fetchPageData = async () => {
    try {
      setIsLoading(true);
      console.log('Fetching rentals data...');
      
      // Fetch rentals and vehicles in parallel
      const [rentalsData, vehiclesData] = await Promise.all([
        rentalService.getVehicleRentals(),
        vehicleService.getVehicles()
      ]);
      
      console.log('Fetched rentals data:', rentalsData);
      setRentals(rentalsData);
      setAvailableVehicles(vehiclesData.map(v => ({ id: v.id, plate: v.plate })));
      
      // Calculate summary
      const totalRevenue = rentalsData.reduce((sum, rental) => sum + rental.rental_amount, 0);
      const totalExpenses = rentalsData.reduce((sum, rental) => sum + calculateTotalExpenses(rental), 0);
      const uniqueVehicles = new Set();
      rentalsData.forEach(rental => {
        rental.rental_vehicles?.forEach(rv => uniqueVehicles.add(rv.vehicle_id));
      });

      setSummary({
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        net_profit: totalRevenue - totalExpenses,
        rental_count: rentalsData.length,
        vehicle_count: uniqueVehicles.size,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: t("rental.errorCreatingRental"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPageData();
  }, []);

  // Filter rentals based on current filters
  const filteredRentals = useMemo(() => rentals.filter(rental => {
    // Date filter
    let dateMatch = true;
    if (dateFilter.from && dateFilter.to) {
      const rentalStartDate = parseISO(rental.rental_start_date);
      const rentalEndDate = parseISO(rental.rental_end_date);
      const filterStart = startOfDay(dateFilter.from);
      const filterEnd = endOfDay(dateFilter.to);
      
      const overlaps = rentalStartDate <= filterEnd && rentalEndDate >= filterStart;
      if (!overlaps) return false;
    }

    // Client filter
    if (clientFilter && rental.client_name) {
      if (!rental.client_name.toLowerCase().includes(clientFilter.toLowerCase())) {
        return false;
      }
    }

    // Vehicle Plate Filter
    if (vehiclePlateFilter && vehiclePlateFilter !== "all") {
      const plateMatch = rental.rental_vehicles?.some(rv => 
        rv.vehicles?.plate === vehiclePlateFilter
      );
      if (!plateMatch) return false;
    }

    return true;
  }), [rentals, dateFilter, clientFilter, vehiclePlateFilter]);

  // Recalculate summary whenever filtered rentals change
  useEffect(() => {
    const totalRevenue = filteredRentals.reduce((sum, rental) => sum + rental.rental_amount, 0);
    const totalExpenses = filteredRentals.reduce((sum, rental) => sum + calculateTotalExpenses(rental), 0);
    const uniqueVehicles = new Set();
    filteredRentals.forEach(rental => {
      rental.rental_vehicles?.forEach(rv => uniqueVehicles.add(rv.vehicle_id));
    });

    setSummary({
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      net_profit: totalRevenue - totalExpenses,
      rental_count: filteredRentals.length,
      vehicle_count: uniqueVehicles.size,
    });
  }, [filteredRentals]);

  const handleDeleteRental = async () => {
    if (!rentalToDelete) return;

    try {
      await rentalService.deleteVehicleRental(rentalToDelete.id);
      toast({
        title: t("messages.success"),
        description: t("rental.rentalDeleted"),
      });
      await fetchPageData();
      setDeleteConfirmationOpen(false);
      setRentalToDelete(null);
    } catch (error) {
      toast({
        title: t("messages.error"),
        description: t("rental.errorDeletingRental"),
        variant: "destructive",
      });
    }
  };

  const handleViewDetails = async (rental: VehicleRental) => {
    try {
      const detailedRental = await rentalService.getVehicleRentalById(rental.id);
      setSelectedRental(detailedRental);
      setShowRentalDetails(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load rental details.",
        variant: "destructive",
      });
    }
  };

  const toggleDateExpansion = (date: string) => {
    setExpandedDates(prev => 
      prev.includes(date) 
        ? prev.filter(d => d !== date)
        : [...prev, date]
    );
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProfitIndicator = (profit: number) => {
    if (profit > 0) return 'text-green-600';
    if (profit < 0) return 'text-red-600';
    return 'text-yellow-600';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading rentals...</p>
        </div>
      </div>
    );
  }

  const groupedRentals = groupByDate ? groupRentalsByDate(filteredRentals) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{t("rental.title")}</h2>
          <p className="text-gray-600">{t("rental.subtitle")}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="flex items-center gap-2">
          <PlusCircle className="h-4 w-4" />
          {t("rental.logNewRental")}
        </Button>
      </div>

      {/* Date Filter */}
      <div className="flex items-center justify-end">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal min-w-[280px]",
                !dateFilter.from && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFilter.from ? (
                dateFilter.to ? (
                  <>
                    {format(dateFilter.from, "LLL dd, y")} -{" "}
                    {format(dateFilter.to, "LLL dd, y")}
                  </>
                ) : (
                  format(dateFilter.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateFilter.from}
              selected={{ from: dateFilter.from, to: dateFilter.to }}
              onSelect={(range) => setDateFilter({ from: range?.from, to: range?.to })}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("rental.totalRevenue")}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.total_revenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("rental.totalExpenses")}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.total_expenses)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("rental.netProfit")}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(summary.net_profit)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("rental.rentals")}</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.rental_count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("table.vehicles")}</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.vehicle_count}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            {t("filters.filters")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Client Filter */}
            <div>
              <Input
                placeholder="Search by client name..."
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
              />
            </div>

            {/* Vehicle Plate Filter */}
            <div>
              <Select value={vehiclePlateFilter} onValueChange={setVehiclePlateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All vehicles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All vehicles</SelectItem>
                  {availableVehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.plate}>
                      {vehicle.plate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* View Toggle */}
            <div>
              <Select value={groupByDate ? "grouped" : "individual"} onValueChange={(value) => setGroupByDate(value === "grouped")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grouped">{t("filters.groupedByDate")}</SelectItem>
                  <SelectItem value="individual">Individual Rentals</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rentals List */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t("rental.rentals")} ({filteredRentals.length} {t("rental.rentals")})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRentals.length === 0 ? (
            <div className="text-center py-8">
              <Car className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">{t("rental.noRentalsFound")}</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating a new rental.</p>
              <div className="mt-6">
                <Button onClick={() => setDialogOpen(true)}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {t("rental.logNewRental")}
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.date")}</TableHead>
                  <TableHead>{t("rental.table.client")}</TableHead>
                  <TableHead>{t("rental.table.vehicles")}</TableHead>
                  <TableHead className="text-right">{t("rental.table.revenue")}</TableHead>
                  <TableHead className="text-right">{t("rental.table.expenses")}</TableHead>
                  <TableHead className="text-right">{t("rental.table.profit")}</TableHead>
                  <TableHead className="text-right">{t("rental.table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRentals.map((rental) => {
                  const netProfit = calculateNetProfit(rental);
                  const totalExpenses = calculateTotalExpenses(rental);
                  
                  return (
                    <TableRow key={rental.id}>
                      <TableCell>{format(parseISO(rental.rental_start_date), "PP")}</TableCell>
                      <TableCell>
                        <div className="font-medium">{rental.client_name || "N/A"}</div>
                        <div className="text-sm text-gray-500">{rental.client_contact}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {rental.rental_vehicles?.map((rv, index) => (
                            <Badge key={index} variant="outline">{rv.vehicles?.plate}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(rental.rental_amount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(totalExpenses)}</TableCell>
                      <TableCell className={`text-right font-medium ${getProfitIndicator(netProfit)}`}>
                        {formatCurrency(netProfit)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleViewDetails(rental)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => {
                              setRentalToDelete(rental);
                              setDeleteConfirmationOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-bold">{t("table.total")}</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(summary.total_revenue)}</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(summary.total_expenses)}</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(summary.net_profit)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmationOpen} onOpenChange={setDeleteConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("rental.deleteConfirmation")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("rental.deleteWarning")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("buttons.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRental} className="bg-red-600 hover:bg-red-700">
              {t("buttons.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rental Details Dialog */}
      <Dialog open={showRentalDetails} onOpenChange={setShowRentalDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("rental.rentalDetails")}</DialogTitle>
          </DialogHeader>
          {selectedRental && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium text-gray-500">{t("rental.clientInformation")}</Label>
                  <div className="mt-1">
                    <div className="font-medium">{selectedRental.client_name || "N/A"}</div>
                    {selectedRental.client_contact && (
                      <div className="text-sm text-gray-600">{selectedRental.client_contact}</div>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">{t("rental.rentalPeriod")}</Label>
                  <div className="mt-1 font-medium">
                    {formatDateRange(selectedRental.rental_start_date, selectedRental.rental_end_date)}
                    <div className="text-sm text-gray-600">
                      {calculateDuration(selectedRental.rental_start_date, selectedRental.rental_end_date)} days
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Summary */}
              <div>
                <Label className="text-sm font-medium text-gray-500">Financial Summary</Label>
                <div className="mt-2 grid gap-3 md:grid-cols-3">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-600">Revenue</div>
                    <div className="text-lg font-semibold text-black">
                      {formatCurrency(selectedRental.rental_amount)}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-600">Expenses</div>
                    <div className="text-lg font-semibold text-black">
                      {formatCurrency(calculateTotalExpenses(selectedRental))}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border">
                    <div className="text-sm text-gray-600">Net Profit</div>
                    <div className="text-lg font-semibold text-yellow-600">
                      {formatCurrency(calculateNetProfit(selectedRental))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Vehicles */}
              <div>
                <Label className="text-sm font-medium text-gray-500">{t("rental.vehiclesRented")}</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedRental.rental_vehicles?.map((rv, index) => (
                    <Badge key={index} variant="outline">
                      🚗 {rv.vehicles?.plate}
                    </Badge>
                  )) || <span className="text-gray-500">No vehicles assigned</span>}
                </div>
              </div>

              {/* Receipts */}
              {selectedRental.rental_receipts && selectedRental.rental_receipts.length > 0 && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">{t("rental.paymentReceipts")}</Label>
                  <div className="mt-2 space-y-2">
                    {selectedRental.rental_receipts.map((receipt, index) => (
                      <div key={receipt.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Receipt className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">{receipt.file_name}</div>
                            <div className="text-sm text-gray-600">
                              {receipt.amount && formatCurrency(receipt.amount)} 
                              {receipt.payment_method && ` • ${receipt.payment_method}`}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(receipt.receipt_url, '_blank')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expenses */}
              {selectedRental.rental_expenses && selectedRental.rental_expenses.length > 0 && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">{t("rental.rentalExpenses")}</Label>
                  <div className="mt-2 space-y-2">
                    {selectedRental.rental_expenses.map((expense) => (
                      <div key={expense.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="font-medium">{expense.category}</div>
                            {expense.description && (
                              <div className="text-sm text-gray-600">{expense.description}</div>
                            )}
                            <div className="text-xs text-gray-500">
                              {format(parseISO(expense.expense_date), "MMM dd, yyyy")}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(expense.amount)}</div>
                          {expense.receipt_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(expense.receipt_url, '_blank')}
                            >
                              <Receipt className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {selectedRental.description && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Description</Label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                    {selectedRental.description}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRentalDetails(false)}>
              {t("buttons.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Rental Dialog */}
      <CreateRentalDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen}
        onRentalCreated={fetchPageData}
      />
    </div>
  );
}
