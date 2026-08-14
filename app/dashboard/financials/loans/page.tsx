"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  BadgeCheck,
  Banknote,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Paperclip,
  PlusCircle,
  RotateCcw,
  Search,
  Trash2,
  Pencil,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/context/AuthContext";
import { loanService, Loan, LOAN_ACCOUNTS } from "@/services/loanService";

// Impala issues loans from a single company account, so the account selector
// stays off here (Royal Express turns it on in its copy of this page).
const SHOW_ISSUING_ACCOUNT = false;

// How long a successful password check keeps the page unlocked (per browser tab).
const UNLOCK_TTL_MS = 30 * 60 * 1000;
const UNLOCK_KEY = "loans-unlocked-until";

const formatCurrency = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "AOA" });

const formatDate = (value: string | null) =>
  value ? format(parseISO(value), "dd MMM yyyy") : "—";

const todayISO = () => format(new Date(), "yyyy-MM-dd");

type StatusFilter = "all" | "open" | "closed";

const emptyForm = () => ({
  borrower_name: "",
  borrower_contact: "",
  amount: "",
  issuing_account: LOAN_ACCOUNTS[0] as string,
  purpose: "",
  issue_date: todayISO(),
  due_date: "",
  notes: "",
});

export default function LoansPage() {
  const { t } = useTranslation("financials");
  const { user } = useAuth();

  // ----- password gate -------------------------------------------------
  const [unlocked, setUnlocked] = useState(false);
  const [checkingUnlock, setCheckingUnlock] = useState(true);
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [verifying, setVerifying] = useState(false);

  // ----- data ----------------------------------------------------------
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");

  // ----- dialogs -------------------------------------------------------
  const [formOpen, setFormOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const [closeTarget, setCloseTarget] = useState<Loan | null>(null);
  const [closeDate, setCloseDate] = useState(todayISO());
  const [closeAmount, setCloseAmount] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [closeSlip, setCloseSlip] = useState<File | null>(null);
  const [closing, setClosing] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Loan | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const until = Number(sessionStorage.getItem(UNLOCK_KEY) || 0);
    if (until > Date.now()) setUnlocked(true);
    setCheckingUnlock(false);
  }, []);

  const loadLoans = useCallback(async () => {
    setLoading(true);
    try {
      setLoans(await loanService.getLoans());
    } catch (error) {
      console.error("Error loading loans:", error);
      toast({
        title: t("messages.error", "Error"),
        description: t("loans.messages.loadFailed", "Could not load loans."),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (unlocked) loadLoans();
  }, [unlocked, loadLoans]);

  const handleUnlock = async () => {
    if (!passwordValue) {
      setPasswordError(t("loans.password.required", "Please enter the password."));
      return;
    }
    setVerifying(true);
    setPasswordError("");
    try {
      const ok = await loanService.verifyPassword(passwordValue);
      if (!ok) {
        setPasswordError(t("loans.password.incorrect", "Incorrect password."));
        setPasswordValue("");
        return;
      }
      sessionStorage.setItem(UNLOCK_KEY, String(Date.now() + UNLOCK_TTL_MS));
      setPasswordValue("");
      setUnlocked(true);
    } catch (error) {
      console.error("Error verifying loans password:", error);
      setPasswordError(
        t("loans.password.verifyFailed", "Could not verify the password. Try again.")
      );
    } finally {
      setVerifying(false);
    }
  };

  const lockPage = () => {
    sessionStorage.removeItem(UNLOCK_KEY);
    setUnlocked(false);
    setLoans([]);
  };

  const openCreate = () => {
    setEditingLoan(null);
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (loan: Loan) => {
    setEditingLoan(loan);
    setForm({
      borrower_name: loan.borrower_name,
      borrower_contact: loan.borrower_contact || "",
      amount: String(loan.amount),
      issuing_account: loan.issuing_account,
      purpose: loan.purpose || "",
      issue_date: loan.issue_date,
      due_date: loan.due_date || "",
      notes: loan.notes || "",
    });
    setFormOpen(true);
  };

  const saveLoan = async () => {
    const amount = Number(form.amount);
    if (!form.borrower_name.trim()) {
      toast({
        title: t("loans.messages.borrowerRequired", "Borrower is required"),
        variant: "destructive",
      });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({
        title: t("loans.messages.amountRequired", "Enter a valid amount"),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        borrower_name: form.borrower_name.trim(),
        borrower_contact: form.borrower_contact.trim() || null,
        amount,
        issuing_account: form.issuing_account,
        purpose: form.purpose.trim() || null,
        issue_date: form.issue_date,
        due_date: form.due_date || null,
        notes: form.notes.trim() || null,
      };

      if (editingLoan) {
        await loanService.updateLoan(editingLoan.id, payload);
        toast({ title: t("loans.messages.updated", "Loan updated") });
      } else {
        await loanService.createLoan(payload, user?.email || "");
        toast({ title: t("loans.messages.created", "Loan recorded") });
      }
      setFormOpen(false);
      setEditingLoan(null);
      await loadLoans();
    } catch (error) {
      console.error("Error saving loan:", error);
      toast({
        title: t("messages.error", "Error"),
        description: t("loans.messages.saveFailed", "Could not save the loan."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const openClose = (loan: Loan) => {
    setCloseTarget(loan);
    setCloseDate(todayISO());
    setCloseAmount(String(loan.amount));
    setCloseNotes(loan.notes || "");
    setCloseSlip(null);
  };

  const confirmClose = async () => {
    if (!closeTarget) return;
    if (!closeSlip && !closeTarget.slip_url) {
      toast({
        title: t("loans.messages.slipRequired", "Bank slip required"),
        description: t(
          "loans.messages.slipRequiredDesc",
          "Attach the bank slip confirming the loan was paid back."
        ),
        variant: "destructive",
      });
      return;
    }

    setClosing(true);
    try {
      const repaid = Number(closeAmount);
      await loanService.closeLoan(closeTarget, {
        slipFile: closeSlip,
        repaymentDate: closeDate,
        repaidAmount: Number.isFinite(repaid) && repaid > 0 ? repaid : closeTarget.amount,
        notes: closeNotes.trim() || null,
        closedBy: user?.email || "",
      });
      toast({ title: t("loans.messages.closed", "Loan closed") });
      setCloseTarget(null);
      await loadLoans();
    } catch (error) {
      console.error("Error closing loan:", error);
      toast({
        title: t("messages.error", "Error"),
        description: t("loans.messages.closeFailed", "Could not close the loan."),
        variant: "destructive",
      });
    } finally {
      setClosing(false);
    }
  };

  const reopen = async (loan: Loan) => {
    try {
      await loanService.reopenLoan(loan.id);
      toast({ title: t("loans.messages.reopened", "Loan reopened") });
      await loadLoans();
    } catch (error) {
      console.error("Error reopening loan:", error);
      toast({
        title: t("messages.error", "Error"),
        description: t("loans.messages.reopenFailed", "Could not reopen the loan."),
        variant: "destructive",
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await loanService.deleteLoan(deleteTarget);
      toast({ title: t("loans.messages.deleted", "Loan deleted") });
      setDeleteTarget(null);
      await loadLoans();
    } catch (error) {
      console.error("Error deleting loan:", error);
      toast({
        title: t("messages.error", "Error"),
        description: t("loans.messages.deleteFailed", "Could not delete the loan."),
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const filteredLoans = useMemo(() => {
    const term = search.trim().toLowerCase();
    return loans.filter((loan) => {
      if (statusFilter !== "all" && loan.status !== statusFilter) return false;
      if (SHOW_ISSUING_ACCOUNT && accountFilter !== "all" && loan.issuing_account !== accountFilter)
        return false;
      if (!term) return true;
      return (
        loan.borrower_name.toLowerCase().includes(term) ||
        (loan.borrower_contact || "").toLowerCase().includes(term) ||
        (loan.purpose || "").toLowerCase().includes(term)
      );
    });
  }, [loans, search, statusFilter, accountFilter]);

  const totals = useMemo(() => {
    const issued = filteredLoans.reduce((sum, l) => sum + Number(l.amount), 0);
    const outstanding = filteredLoans
      .filter((l) => l.status === "open")
      .reduce((sum, l) => sum + Number(l.amount), 0);
    const repaid = filteredLoans
      .filter((l) => l.status === "closed")
      .reduce((sum, l) => sum + Number(l.repaid_amount ?? l.amount), 0);
    return {
      issued,
      outstanding,
      repaid,
      openCount: filteredLoans.filter((l) => l.status === "open").length,
    };
  }, [filteredLoans]);

  if (checkingUnlock) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="flex justify-center py-16">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Lock className="h-5 w-5" />
            </div>
            <CardTitle>{t("loans.password.title", "Protected page")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t(
                "loans.password.description",
                "Enter the password to view the loans register."
              )}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="loans-password">{t("loans.password.label", "Password")}</Label>
              <div className="relative">
                <Input
                  id="loans-password"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="off"
                  value={passwordValue}
                  onChange={(e) => {
                    setPasswordValue(e.target.value);
                    if (passwordError) setPasswordError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUnlock();
                  }}
                  className={passwordError ? "border-red-500 pr-10" : "pr-10"}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setPasswordVisible((v) => !v)}
                  aria-label={passwordVisible ? "Hide password" : "Show password"}
                >
                  {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
            </div>
            <Button className="w-full" onClick={handleUnlock} disabled={verifying}>
              {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("loans.password.unlock", "Unlock")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("loans.title", "Loans")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("loans.subtitle", "Loans the company has issued and who received them.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={lockPage}>
            <Lock className="mr-2 h-4 w-4" />
            {t("loans.lock", "Lock")}
          </Button>
          <Button size="sm" onClick={openCreate}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {t("loans.newLoan", "New loan")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("loans.summary.issued", "Total issued")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.issued)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("loans.summary.outstanding", "Outstanding")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatCurrency(totals.outstanding)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("loans.summary.repaid", "Repaid")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(totals.repaid)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("loans.summary.openLoans", "Open loans")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.openCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Banknote className="h-4 w-4" />
            {t("loans.register", "Loan register")}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("loans.searchPlaceholder", "Search borrower...")}
                className="w-52 pl-8"
              />
            </div>
            {SHOW_ISSUING_ACCOUNT && (
              <Select value={accountFilter} onValueChange={setAccountFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("loans.filters.allAccounts", "All accounts")}</SelectItem>
                  {LOAN_ACCOUNTS.map((account) => (
                    <SelectItem key={account} value={account}>
                      {account}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("loans.filters.allStatuses", "All statuses")}</SelectItem>
                <SelectItem value="open">{t("loans.status.open", "Open")}</SelectItem>
                <SelectItem value="closed">{t("loans.status.closed", "Closed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLoans.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {t("loans.empty", "No loans recorded yet.")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("loans.table.borrower", "Issued to")}</TableHead>
                    <TableHead className="text-right">{t("loans.table.amount", "Amount")}</TableHead>
                    {SHOW_ISSUING_ACCOUNT && (
                      <TableHead>{t("loans.table.account", "Issued from")}</TableHead>
                    )}
                    <TableHead>{t("loans.table.issueDate", "Issued on")}</TableHead>
                    <TableHead>{t("loans.table.dueDate", "Due")}</TableHead>
                    <TableHead>{t("loans.table.status", "Status")}</TableHead>
                    <TableHead>{t("loans.table.slip", "Bank slip")}</TableHead>
                    <TableHead className="text-right">{t("loans.table.actions", "Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLoans.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell>
                        <div className="font-medium">{loan.borrower_name}</div>
                        {(loan.borrower_contact || loan.purpose) && (
                          <div className="text-xs text-muted-foreground">
                            {[loan.borrower_contact, loan.purpose].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(loan.amount))}
                        {loan.status === "closed" &&
                          loan.repaid_amount != null &&
                          Number(loan.repaid_amount) !== Number(loan.amount) && (
                            <div className="text-xs text-muted-foreground">
                              {t("loans.table.repaid", "Repaid")}:{" "}
                              {formatCurrency(Number(loan.repaid_amount))}
                            </div>
                          )}
                      </TableCell>
                      {SHOW_ISSUING_ACCOUNT && (
                        <TableCell>
                          <Badge variant="outline">{loan.issuing_account}</Badge>
                        </TableCell>
                      )}
                      <TableCell>{formatDate(loan.issue_date)}</TableCell>
                      <TableCell>{formatDate(loan.due_date)}</TableCell>
                      <TableCell>
                        {loan.status === "closed" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            <BadgeCheck className="mr-1 h-3 w-3" />
                            {t("loans.status.closed", "Closed")}
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                            {t("loans.status.open", "Open")}
                          </Badge>
                        )}
                        {loan.status === "closed" && loan.repayment_date && (
                          <div className="text-xs text-muted-foreground">
                            {formatDate(loan.repayment_date)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {loan.slip_url ? (
                          <a
                            href={loan.slip_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            {t("loans.table.viewSlip", "View")}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {loan.status === "open" ? (
                            <Button size="sm" onClick={() => openClose(loan)}>
                              {t("loans.actions.close", "Close loan")}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => reopen(loan)}
                              title={t("loans.actions.reopen", "Reopen")}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(loan)}
                            title={t("loans.actions.edit", "Edit")}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteTarget(loan)}
                            title={t("loans.actions.delete", "Delete")}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / edit loan */}
      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingLoan(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingLoan
                ? t("loans.form.editTitle", "Edit loan")
                : t("loans.form.createTitle", "Record a loan")}
            </DialogTitle>
            <DialogDescription>
              {t("loans.form.description", "Capture who received the loan and how much.")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="loan-borrower">{t("loans.form.borrower", "Issued to")} *</Label>
              <Input
                id="loan-borrower"
                value={form.borrower_name}
                onChange={(e) => setForm({ ...form, borrower_name: e.target.value })}
                placeholder={t("loans.form.borrowerPlaceholder", "Name of person or company")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="loan-contact">{t("loans.form.contact", "Contact")}</Label>
                <Input
                  id="loan-contact"
                  value={form.borrower_contact}
                  onChange={(e) => setForm({ ...form, borrower_contact: e.target.value })}
                  placeholder={t("loans.form.contactPlaceholder", "Phone or email")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loan-amount">{t("loans.form.amount", "Amount (Kz)")} *</Label>
                <Input
                  id="loan-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
            </div>

            {SHOW_ISSUING_ACCOUNT && (
              <div className="space-y-2">
                <Label>{t("loans.form.account", "Issuing account")} *</Label>
                <Select
                  value={form.issuing_account}
                  onValueChange={(value) => setForm({ ...form, issuing_account: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOAN_ACCOUNTS.map((account) => (
                      <SelectItem key={account} value={account}>
                        {account}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t("loans.form.accountHint", "Which company account the money came out of.")}
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="loan-issue-date">{t("loans.form.issueDate", "Issued on")} *</Label>
                <Input
                  id="loan-issue-date"
                  type="date"
                  value={form.issue_date}
                  onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="loan-due-date">{t("loans.form.dueDate", "Due date")}</Label>
                <Input
                  id="loan-due-date"
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="loan-purpose">{t("loans.form.purpose", "Purpose")}</Label>
              <Input
                id="loan-purpose"
                value={form.purpose}
                onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="loan-notes">{t("loans.form.notes", "Notes")}</Label>
              <Textarea
                id="loan-notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {t("buttons.cancel", "Cancel")}
            </Button>
            <Button onClick={saveLoan} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("buttons.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close loan with bank slip */}
      <Dialog open={!!closeTarget} onOpenChange={(open) => !open && setCloseTarget(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("loans.close.title", "Close loan")}</DialogTitle>
            <DialogDescription>
              {t(
                "loans.close.description",
                "Attach the bank slip confirming this loan was paid back."
              )}
            </DialogDescription>
          </DialogHeader>

          {closeTarget && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="font-medium">{closeTarget.borrower_name}</div>
                <div className="text-muted-foreground">
                  {formatCurrency(Number(closeTarget.amount))}
                  {SHOW_ISSUING_ACCOUNT && ` · ${closeTarget.issuing_account}`}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="close-date">
                    {t("loans.close.repaymentDate", "Repayment date")} *
                  </Label>
                  <Input
                    id="close-date"
                    type="date"
                    value={closeDate}
                    onChange={(e) => setCloseDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="close-amount">
                    {t("loans.close.repaidAmount", "Amount repaid (Kz)")}
                  </Label>
                  <Input
                    id="close-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={closeAmount}
                    onChange={(e) => setCloseAmount(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="close-slip">{t("loans.close.slip", "Bank slip")} *</Label>
                <Input
                  id="close-slip"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setCloseSlip(e.target.files?.[0] || null)}
                />
                {closeTarget.slip_url && !closeSlip && (
                  <p className="text-xs text-muted-foreground">
                    {t("loans.close.existingSlip", "A slip is already on file; upload a new one to replace it.")}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="close-notes">{t("loans.form.notes", "Notes")}</Label>
                <Textarea
                  id="close-notes"
                  rows={3}
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseTarget(null)} disabled={closing}>
              {t("buttons.cancel", "Cancel")}
            </Button>
            <Button onClick={confirmClose} disabled={closing}>
              {closing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("loans.close.confirm", "Mark as paid")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("loans.delete.title", "Delete this loan?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("loans.delete.description", "This removes the loan and its bank slip permanently.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("buttons.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("loans.actions.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
