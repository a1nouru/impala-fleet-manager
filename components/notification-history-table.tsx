"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  History, 
  MessageSquare, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Eye,
  RotateCcw,
  Download
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { type NotificationLog } from "@/services/notificationService";

interface NotificationHistoryTableProps {
  logs: NotificationLog[];
  onRefresh: () => void;
}

export function NotificationHistoryTable({ logs, onRefresh }: NotificationHistoryTableProps) {
  const { t } = useTranslation("notifications");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTrigger, setFilterTrigger] = useState<string>("all");

  // Filter logs based on selected filters
  const filteredLogs = logs.filter(log => {
    const statusMatch = filterStatus === "all" || log.status === filterStatus;
    const triggerMatch = filterTrigger === "all" || log.trigger_type === filterTrigger;
    return statusMatch && triggerMatch;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTriggerColor = (trigger: string) => {
    switch (trigger) {
      case 'manual':
        return 'bg-purple-100 text-purple-800';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'threshold_met':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const exportHistory = () => {
    // Create CSV content
    const headers = ['Date', 'Alert Name', 'Group', 'Status', 'Trigger Type', 'Message'];
    const csvContent = [
      headers.join(','),
      ...filteredLogs.map(log => [
        log.created_at,
        log.notifications?.name || 'Unknown',
        log.whatsapp_group_name,
        log.status,
        log.trigger_type,
        `"${log.message_content.replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `notification-history-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {t("history.title")}
            </CardTitle>
            <CardDescription>
              {t("history.subtitle")}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportHistory}>
              <Download className="h-4 w-4 mr-1" />
              {t("history.exportHistory")}
            </Button>
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("history.filterByStatus")}</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">{t("status.pending")}</SelectItem>
                <SelectItem value="sent">{t("status.sent")}</SelectItem>
                <SelectItem value="delivered">{t("status.delivered")}</SelectItem>
                <SelectItem value="failed">{t("status.failed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t("history.filterByAlert")}</label>
            <Select value={filterTrigger} onValueChange={setFilterTrigger}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Triggers</SelectItem>
                <SelectItem value="manual">{t("triggers.manual")}</SelectItem>
                <SelectItem value="scheduled">{t("triggers.scheduled")}</SelectItem>
                <SelectItem value="threshold_met">{t("triggers.threshold_met")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <div className="text-sm text-gray-600">
              {t("history.historyCount", { count: filteredLogs.length })}
            </div>
          </div>
        </div>

        {/* History Table */}
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {t("history.noHistory")}
            </h3>
            <p className="text-gray-600">
              Sent notifications will appear here
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">{t("table.sentAt")}</TableHead>
                  <TableHead>Alert Name</TableHead>
                  <TableHead>{t("table.group")}</TableHead>
                  <TableHead className="w-24">{t("table.status")}</TableHead>
                  <TableHead className="w-32">{t("table.trigger")}</TableHead>
                  <TableHead className="w-24">{t("table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-sm">
                      {formatDateTime(log.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {log.notifications?.name || 'Unknown Alert'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {log.whatsapp_group_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(log.status)}
                        <Badge className={getStatusColor(log.status)}>
                          {t(`status.${log.status}`)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getTriggerColor(log.trigger_type)}>
                        {t(`triggers.${log.trigger_type}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Eye className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <MessageSquare className="h-5 w-5" />
                              Message Details
                            </DialogTitle>
                            <DialogDescription>
                              Sent to {log.whatsapp_group_name} on {formatDateTime(log.created_at)}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-medium mb-2">Message Content:</h4>
                              <div className="bg-green-50 border border-green-200 rounded-lg p-3 font-mono text-sm whitespace-pre-wrap">
                                {log.message_content}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium">Status:</span>
                                <div className="flex items-center gap-1 mt-1">
                                  {getStatusIcon(log.status)}
                                  <Badge className={getStatusColor(log.status)}>
                                    {t(`status.${log.status}`)}
                                  </Badge>
                                </div>
                              </div>
                              <div>
                                <span className="font-medium">Trigger:</span>
                                <div className="mt-1">
                                  <Badge className={getTriggerColor(log.trigger_type)}>
                                    {t(`triggers.${log.trigger_type}`)}
                                  </Badge>
                                </div>
                              </div>
                              {log.sent_at && (
                                <div>
                                  <span className="font-medium">Sent At:</span>
                                  <div className="mt-1 font-mono text-xs">
                                    {formatDateTime(log.sent_at)}
                                  </div>
                                </div>
                              )}
                              {log.delivered_at && (
                                <div>
                                  <span className="font-medium">Delivered At:</span>
                                  <div className="mt-1 font-mono text-xs">
                                    {formatDateTime(log.delivered_at)}
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {log.error_message && (
                              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <h4 className="font-medium text-red-800 mb-2">Error Message:</h4>
                                <p className="text-red-700 text-sm">{log.error_message}</p>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

