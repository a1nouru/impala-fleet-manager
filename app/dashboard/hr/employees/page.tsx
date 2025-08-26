"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Loader2, 
  PlusCircle, 
  Edit, 
  Users,
  DollarSign,
  UserCheck,
  UserX
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { hrService, Employee } from "@/services/hrService";

// Helper to format currency
const formatCurrency = (value: number) => {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "AOA",
  });
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dialog states
  const [newEmployeeDialogOpen, setNewEmployeeDialogOpen] = useState(false);
  const [editEmployeeDialogOpen, setEditEmployeeDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Form states
  const [newEmployee, setNewEmployee] = useState({
    nome: "",
    iban_nib: "",
    valor: 0,
    tipo_despesas: "",
    is_active: true,
  });

  const [editedEmployee, setEditedEmployee] = useState({
    nome: "",
    iban_nib: "",
    valor: 0,
    tipo_despesas: "",
    is_active: true,
  });

  // Validation states
  const [fieldErrors, setFieldErrors] = useState({
    nome: "",
    iban_nib: "",
    valor: "",
    tipo_despesas: "",
  });

  const [editFieldErrors, setEditFieldErrors] = useState({
    nome: "",
    iban_nib: "",
    valor: "",
    tipo_despesas: "",
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Validation functions
  const validateIbanNib = (iban: string): string => {
    // Angolan IBAN format: AO06.0000.0000.0000.0000.0000.0
    const ibanPattern = /^AO\d{2}\.\d{4}\.\d{4}\.\d{4}\.\d{4}\.\d{4}\.\d$/;
    
    if (!iban) {
      return "IBAN/NIB is required";
    }
    
    if (!ibanPattern.test(iban)) {
      return "Invalid IBAN/NIB format. Use: AO06.0000.0000.0000.0000.0000.0";
    }
    
    return "";
  };

  const validateEmployeeCode = (code: string): string => {
    // Employee code format: OUR0000
    const codePattern = /^OUR\d{4}$/;
    
    if (!code) {
      return "Employee code is required";
    }
    
    if (!codePattern.test(code)) {
      return "Invalid employee code format. Use: OUR0000";
    }
    
    return "";
  };

  const validateName = (name: string): string => {
    if (!name || name.trim().length < 2) {
      return "Full name must be at least 2 characters";
    }
    return "";
  };

  const validateSalary = (salary: number): string => {
    if (!salary || salary <= 0) {
      return "Salary must be greater than 0";
    }
    return "";
  };

  // Auto-generate employee code
  const generateEmployeeCode = (): string => {
    const existingCodes = employees.map(emp => emp.tipo_despesas || "");
    let nextNumber = 1;
    
    // Find the highest existing number
    existingCodes.forEach(code => {
      const match = code.match(/^OUR(\d{4})$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num >= nextNumber) {
          nextNumber = num + 1;
        }
      }
    });
    
    return `OUR${nextNumber.toString().padStart(4, '0')}`;
  };

  // Auto-format IBAN/NIB as user types
  const formatIbanNib = (value: string): string => {
    // Remove all non-alphanumeric characters
    const cleaned = value.replace(/[^\w]/g, '');
    
    // Ensure it starts with AO
    let formatted = cleaned;
    if (!formatted.startsWith('AO')) {
      formatted = 'AO' + formatted.replace(/^AO/i, '');
    }
    
    // Add dots in the correct positions
    if (formatted.length > 4) {
      formatted = formatted.slice(0, 4) + '.' + formatted.slice(4);
    }
    if (formatted.length > 9) {
      formatted = formatted.slice(0, 9) + '.' + formatted.slice(9);
    }
    if (formatted.length > 14) {
      formatted = formatted.slice(0, 14) + '.' + formatted.slice(14);
    }
    if (formatted.length > 19) {
      formatted = formatted.slice(0, 19) + '.' + formatted.slice(19);
    }
    if (formatted.length > 24) {
      formatted = formatted.slice(0, 24) + '.' + formatted.slice(24);
    }
    
    // Limit to correct length
    return formatted.slice(0, 29);
  };

  const fetchEmployees = async () => {
    try {
      setIsLoading(true);
      const employeesData = await hrService.getEmployees();
      setEmployees(employeesData);
    } catch (error) {
      console.error("Error fetching employees:", error);
      toast({
        title: "❌ Error",
        description: "Failed to load employees.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  // Filter employees
  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.tipo_despesas.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.iban_nib.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || 
                         (statusFilter === "active" && employee.is_active) ||
                         (statusFilter === "inactive" && !employee.is_active);
    
    return matchesSearch && matchesStatus;
  });

  // Statistics
  const activeEmployees = employees.filter(e => e.is_active).length;
  const inactiveEmployees = employees.filter(e => !e.is_active).length;
  const totalSalary = employees.filter(e => e.is_active).reduce((sum, e) => sum + e.valor, 0);

  // Form handlers
  const handleInputChange = (field: string, value: string | number | boolean) => {
    let processedValue = value;
    
    // Auto-format IBAN/NIB
    if (field === 'iban_nib' && typeof value === 'string') {
      processedValue = formatIbanNib(value);
    }
    
    // Auto-generate employee code if field is focused and empty
    if (field === 'tipo_despesas' && typeof value === 'string' && value === '') {
      processedValue = generateEmployeeCode();
    }
    
    setNewEmployee(prev => ({ 
      ...prev, 
      [field]: field === 'valor' ? Number(value) || 0 : processedValue 
    }));

    // Real-time validation
    let error = "";
    if (field === 'nome' && typeof processedValue === 'string') {
      error = validateName(processedValue);
    } else if (field === 'iban_nib' && typeof processedValue === 'string') {
      error = validateIbanNib(processedValue);
    } else if (field === 'valor') {
      error = validateSalary(Number(processedValue));
    } else if (field === 'tipo_despesas' && typeof processedValue === 'string') {
      error = validateEmployeeCode(processedValue);
    }

    setFieldErrors(prev => ({
      ...prev,
      [field]: error
    }));
  };

  const handleEditInputChange = (field: string, value: string | number | boolean) => {
    let processedValue = value;
    
    // Auto-format IBAN/NIB
    if (field === 'iban_nib' && typeof value === 'string') {
      processedValue = formatIbanNib(value);
    }
    
    setEditedEmployee(prev => ({ 
      ...prev, 
      [field]: field === 'valor' ? Number(value) || 0 : processedValue 
    }));

    // Real-time validation for edit form
    let error = "";
    if (field === 'nome' && typeof processedValue === 'string') {
      error = validateName(processedValue);
    } else if (field === 'iban_nib' && typeof processedValue === 'string') {
      error = validateIbanNib(processedValue);
    } else if (field === 'valor') {
      error = validateSalary(Number(processedValue));
    } else if (field === 'tipo_despesas' && typeof processedValue === 'string') {
      error = validateEmployeeCode(processedValue);
    }

    setEditFieldErrors(prev => ({
      ...prev,
      [field]: error
    }));
  };

  const resetForm = () => {
    setNewEmployee({
      nome: "",
      iban_nib: "",
      valor: 0,
      tipo_despesas: "",
      is_active: true,
    });
    setFieldErrors({
      nome: "",
      iban_nib: "",
      valor: "",
      tipo_despesas: "",
    });
  };

  const handleSubmit = async () => {
    // Validate all fields
    const nameError = validateName(newEmployee.nome);
    const ibanError = validateIbanNib(newEmployee.iban_nib);
    const salaryError = validateSalary(newEmployee.valor);
    const codeError = validateEmployeeCode(newEmployee.tipo_despesas);

    // Update error states
    setFieldErrors({
      nome: nameError,
      iban_nib: ibanError,
      valor: salaryError,
      tipo_despesas: codeError,
    });

    // Check if there are any errors
    if (nameError || ibanError || salaryError || codeError) {
      toast({
        title: "❌ Validation Error",
        description: "Please fix the errors below before submitting.",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate employee code
    const existingEmployee = employees.find(emp => emp.tipo_despesas === newEmployee.tipo_despesas);
    if (existingEmployee) {
      setFieldErrors(prev => ({
        ...prev,
        tipo_despesas: "Employee code already exists"
      }));
      toast({
        title: "❌ Duplicate Error",
        description: "An employee with this code already exists.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await hrService.createEmployee({
        ...newEmployee,
        referencia_transferencia: "PAGAMENTO",
        referencia_empresa: "ROYAL EXPRESS",
        morada_beneficiario: "LUANDA",
        moeda: "AKZ",
        codigo_estatistico: "PAGAMENTO DE SALARIO"
      });
      toast({
        title: "✅ Success",
        description: "Employee created successfully.",
      });
      setNewEmployeeDialogOpen(false);
      resetForm();
      fetchEmployees(); // Refresh data
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Failed to create employee. Employee code might already exist.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (employee: Employee) => {
    setEditingEmployee(employee);
    setEditedEmployee({
      nome: employee.nome,
      iban_nib: employee.iban_nib,
      valor: employee.valor,
      tipo_despesas: employee.tipo_despesas,
      is_active: employee.is_active,
    });
    setEditEmployeeDialogOpen(true);
  };

  const handleUpdateEmployee = async () => {
    if (!editingEmployee) return;

    if (!editedEmployee.nome || !editedEmployee.iban_nib || !editedEmployee.tipo_despesas || editedEmployee.valor <= 0) {
      toast({
        title: "❌ Validation Error",
        description: "Please fill out all required fields with valid values.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await hrService.updateEmployee(editingEmployee.id, editedEmployee);
      toast({
        title: "✅ Success",
        description: "Employee updated successfully.",
      });
      setEditEmployeeDialogOpen(false);
      fetchEmployees(); // Refresh data
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Failed to update employee.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <Users className="h-6 w-6" />
            Employees
          </h1>
          <Badge variant="outline">{filteredEmployees.length} of {employees.length} employees</Badge>
        </div>
        
        <Dialog open={newEmployeeDialogOpen} onOpenChange={setNewEmployeeDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-black hover:bg-gray-800 text-white">
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
              <DialogDescription>
                Add a new employee to the payroll system.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Full Name <span className="text-red-500">*</span></Label>
                <Input
                  value={newEmployee.nome}
                  onChange={(e) => handleInputChange("nome", e.target.value)}
                  placeholder="Enter employee full name"
                  className={cn(fieldErrors.nome && "border-red-500")}
                />
                {fieldErrors.nome && (
                  <p className="text-sm text-red-500">{fieldErrors.nome}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label>IBAN/NIB <span className="text-red-500">*</span></Label>
                <Input
                  value={newEmployee.iban_nib}
                  onChange={(e) => handleInputChange("iban_nib", e.target.value)}
                  placeholder="AO06.0000.0000.0000.0000.0000.0"
                  className={cn(fieldErrors.iban_nib && "border-red-500")}
                />
                {fieldErrors.iban_nib && (
                  <p className="text-sm text-red-500">{fieldErrors.iban_nib}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Format will be automatically applied as you type
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Monthly Salary (AOA) <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newEmployee.valor}
                    onChange={(e) => handleInputChange("valor", e.target.value)}
                    placeholder="0.00"
                    className={cn(fieldErrors.valor && "border-red-500")}
                  />
                  {fieldErrors.valor && (
                    <p className="text-sm text-red-500">{fieldErrors.valor}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label>Employee Code <span className="text-red-500">*</span></Label>
                  <div className="flex gap-2">
                    <Input
                      value={newEmployee.tipo_despesas}
                      onChange={(e) => handleInputChange("tipo_despesas", e.target.value)}
                      placeholder="OUR0000"
                      className={cn(fieldErrors.tipo_despesas && "border-red-500")}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleInputChange("tipo_despesas", generateEmployeeCode())}
                      className="shrink-0"
                    >
                      Auto
                    </Button>
                  </div>
                  {fieldErrors.tipo_despesas && (
                    <p className="text-sm text-red-500">{fieldErrors.tipo_despesas}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Click "Auto" to generate next available code
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={newEmployee.is_active ? "active" : "inactive"} onValueChange={(value) => handleInputChange("is_active", value === "active")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewEmployeeDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-black hover:bg-gray-800 text-white">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Employee
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.length}</div>
            <p className="text-xs text-muted-foreground">All employees</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{activeEmployees}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive Employees</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inactiveEmployees}</div>
            <p className="text-xs text-muted-foreground">Currently inactive</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Monthly Salary</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalSalary)}</div>
            <p className="text-xs text-muted-foreground">Active employees only</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label>Search:</Label>
              <Input
                placeholder="Search by name, code, or IBAN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-[300px]"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <Label>Status:</Label>
              <Select value={statusFilter} onValueChange={(value: "all" | "active" | "inactive") => setStatusFilter(value)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="inactive">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("all");
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Employees Table */}
      <Card>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredEmployees.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Employee Code</TableHead>
                  <TableHead>IBAN/NIB</TableHead>
                  <TableHead className="text-right">Monthly Salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{employee.nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{employee.tipo_despesas}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{employee.iban_nib}</TableCell>
                    <TableCell className="text-right">{formatCurrency(employee.valor)}</TableCell>
                    <TableCell>
                      <Badge variant={employee.is_active ? "default" : "secondary"}>
                        {employee.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleEditClick(employee)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium">No employees found</p>
              <p className="text-sm">Try adjusting your search criteria or add a new employee.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Employee Dialog */}
      {editingEmployee && (
        <Dialog open={editEmployeeDialogOpen} onOpenChange={setEditEmployeeDialogOpen}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Edit Employee</DialogTitle>
              <DialogDescription>
                Update employee information and payroll details.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={editedEmployee.nome}
                  onChange={(e) => handleEditInputChange("nome", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>IBAN/NIB</Label>
                <Input
                  value={editedEmployee.iban_nib}
                  onChange={(e) => handleEditInputChange("iban_nib", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Monthly Salary (AOA)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editedEmployee.valor}
                    onChange={(e) => handleEditInputChange("valor", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Employee Code</Label>
                  <Input
                    value={editedEmployee.tipo_despesas}
                    onChange={(e) => handleEditInputChange("tipo_despesas", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editedEmployee.is_active ? "active" : "inactive"} onValueChange={(value) => handleEditInputChange("is_active", value === "active")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditEmployeeDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateEmployee} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Employee
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
