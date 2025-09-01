"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bell, 
  MessageSquare, 
  Calendar, 
  DollarSign, 
  Clock, 
  Repeat, 
  Info,
  Eye,
  Lightbulb
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { notificationService, type Notification, type CreateNotificationData, type UpdateNotificationData } from "@/services/notificationService";

interface CreateNotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notification?: Notification | null;
  onNotificationSaved: () => void;
}

export function CreateNotificationDialog({
  open,
  onOpenChange,
  notification,
  onNotificationSaved
}: CreateNotificationDialogProps) {
  const { t } = useTranslation("notifications");
  const [loading, setLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    alert_type: "date_based" as const,
    amount: "",
    event_date: "",
    notification_time: "",
    whatsapp_group_id: "",
    whatsapp_group_name: "",
    message_template: "",
    is_recurring: false,
    recurrence_type: "daily" as const,
    recurrence_interval: "1",
    is_active: true
  });

  // Template options
  const messageTemplates = {
    payroll_reminder: t("templates.payroll_reminder"),
    maintenance_due: t("templates.maintenance_due"),
    revenue_target: t("templates.revenue_target"),
    deposit_reminder: t("templates.deposit_reminder"),
    custom: t("templates.custom")
  };

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (notification) {
        // Edit mode - populate form with existing data
        setFormData({
          name: notification.name,
          description: notification.description || "",
          alert_type: notification.alert_type,
          amount: notification.amount?.toString() || "",
          event_date: notification.event_date || "",
          notification_time: notification.notification_time || "",
          whatsapp_group_id: notification.whatsapp_group_id,
          whatsapp_group_name: notification.whatsapp_group_name,
          message_template: notification.message_template,
          is_recurring: notification.is_recurring,
          recurrence_type: notification.recurrence_type || "daily",
          recurrence_interval: notification.recurrence_interval?.toString() || "1",
          is_active: notification.is_active
        });
      } else {
        // Create mode - reset to defaults
        setFormData({
          name: "",
          description: "",
          alert_type: "date_based",
          amount: "",
          event_date: "",
          notification_time: "09:00",
          whatsapp_group_id: "",
          whatsapp_group_name: "",
          message_template: messageTemplates.payroll_reminder,
          is_recurring: false,
          recurrence_type: "daily",
          recurrence_interval: "1",
          is_active: true
        });
      }
      setPreviewMode(false);
    }
  }, [open, notification, messageTemplates.payroll_reminder]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTemplateSelect = (template: string) => {
    if (template === "custom") {
      handleInputChange("message_template", "");
    } else {
      handleInputChange("message_template", messageTemplates[template as keyof typeof messageTemplates]);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      // Validate required fields
      if (!formData.name.trim()) {
        alert(t("messages.missingRequiredFields"));
        return;
      }

      if (!formData.whatsapp_group_id.trim() || !formData.whatsapp_group_name.trim()) {
        alert(t("messages.invalidWhatsAppConfig"));
        return;
      }

      if (formData.alert_type === "amount_threshold" && (!formData.amount || isNaN(Number(formData.amount)))) {
        alert(t("messages.invalidAmount"));
        return;
      }

      if (formData.alert_type === "date_based" && !formData.event_date) {
        alert(t("messages.invalidDate"));
        return;
      }

      // Prepare data for submission
      const submitData: CreateNotificationData | UpdateNotificationData = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        alert_type: formData.alert_type,
        amount: formData.amount ? Number(formData.amount) : undefined,
        event_date: formData.event_date || undefined,
        notification_time: formData.notification_time || undefined,
        whatsapp_group_id: formData.whatsapp_group_id.trim(),
        whatsapp_group_name: formData.whatsapp_group_name.trim(),
        message_template: formData.message_template,
        is_recurring: formData.is_recurring,
        recurrence_type: formData.is_recurring ? formData.recurrence_type : undefined,
        recurrence_interval: formData.is_recurring ? Number(formData.recurrence_interval) : undefined,
        is_active: formData.is_active
      };

      if (notification) {
        // Update existing notification
        await notificationService.updateNotification(notification.id, submitData);
      } else {
        // Create new notification
        await notificationService.createNotification(submitData as CreateNotificationData);
      }

      onNotificationSaved();
      onOpenChange(false);
      
    } catch (error) {
      console.error("Error saving notification:", error);
      alert("Error saving notification. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const renderPreview = async () => {
    try {
      const dynamicVars = await notificationService.getDynamicVariableValues();
      const previewMessage = notificationService.processMessageTemplate(
        formData.message_template,
        {
          ...dynamicVars,
          alert_name: formData.name || "Sample Alert",
          amount: formData.amount || "1000000",
          event_date: formData.event_date || dynamicVars.today_date
        }
      );

      return (
        <Card className="mt-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Message Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 font-mono text-sm whitespace-pre-wrap">
              {previewMessage}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              📱 To: {formData.whatsapp_group_name || "WhatsApp Group"}
            </div>
          </CardContent>
        </Card>
      );
    } catch (error) {
      return (
        <Card className="mt-4">
          <CardContent className="py-3">
            <div className="text-red-600 text-sm">Error generating preview</div>
          </CardContent>
        </Card>
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {notification ? t("createAlert.title").replace("Create New", "Edit") : t("createAlert.title")}
          </DialogTitle>
          <DialogDescription>
            {t("createAlert.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button
            variant={!previewMode ? "default" : "outline"}
            size="sm"
            onClick={() => setPreviewMode(false)}
          >
            <Info className="h-4 w-4 mr-1" />
            Configure
          </Button>
          <Button
            variant={previewMode ? "default" : "outline"}
            size="sm"
            onClick={() => setPreviewMode(true)}
          >
            <Eye className="h-4 w-4 mr-1" />
            Preview
          </Button>
        </div>

        <ScrollArea className="max-h-[60vh]">
          {!previewMode ? (
            <div className="space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("createAlert.basicInfo")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">{t("fields.name")} *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleInputChange("name", e.target.value)}
                        placeholder={t("fields.namePlaceholder")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="alert_type">{t("fields.alertType")} *</Label>
                      <Select
                        value={formData.alert_type}
                        onValueChange={(value) => handleInputChange("alert_type", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="amount_threshold">
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4" />
                              {t("alertTypes.amount_threshold")}
                            </div>
                          </SelectItem>
                          <SelectItem value="date_based">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              {t("alertTypes.date_based")}
                            </div>
                          </SelectItem>
                          <SelectItem value="scheduled_reminder">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              {t("alertTypes.scheduled_reminder")}
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">{t("fields.description")}</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange("description", e.target.value)}
                      placeholder={t("fields.descriptionPlaceholder")}
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Alert Conditions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("createAlert.alertConditions")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {formData.alert_type === "amount_threshold" && (
                    <div className="space-y-2">
                      <Label htmlFor="amount">{t("fields.amount")} *</Label>
                      <Input
                        id="amount"
                        type="number"
                        value={formData.amount}
                        onChange={(e) => handleInputChange("amount", e.target.value)}
                        placeholder={t("fields.amountPlaceholder")}
                      />
                    </div>
                  )}

                  {formData.alert_type === "date_based" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="event_date">{t("fields.eventDate")} *</Label>
                        <Input
                          id="event_date"
                          type="date"
                          value={formData.event_date}
                          onChange={(e) => handleInputChange("event_date", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notification_time">{t("fields.notificationTime")}</Label>
                        <Input
                          id="notification_time"
                          type="time"
                          value={formData.notification_time}
                          onChange={(e) => handleInputChange("notification_time", e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {(formData.alert_type === "scheduled_reminder") && (
                    <div className="space-y-2">
                      <Label htmlFor="notification_time">{t("fields.notificationTime")}</Label>
                      <Input
                        id="notification_time"
                        type="time"
                        value={formData.notification_time}
                        onChange={(e) => handleInputChange("notification_time", e.target.value)}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* WhatsApp Configuration */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("createAlert.whatsappConfig")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp_group_id">{t("fields.whatsappGroupId")} *</Label>
                      <Input
                        id="whatsapp_group_id"
                        value={formData.whatsapp_group_id}
                        onChange={(e) => handleInputChange("whatsapp_group_id", e.target.value)}
                        placeholder={t("fields.whatsappGroupIdPlaceholder")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp_group_name">{t("fields.whatsappGroupName")} *</Label>
                      <Input
                        id="whatsapp_group_name"
                        value={formData.whatsapp_group_name}
                        onChange={(e) => handleInputChange("whatsapp_group_name", e.target.value)}
                        placeholder={t("fields.whatsappGroupNamePlaceholder")}
                      />
                    </div>
                  </div>

                  <div className="text-xs text-gray-600 bg-blue-50 p-3 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="whitespace-pre-line">{t("messages.whatsappGroupHelp")}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Message Template */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("createAlert.messageTemplate")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Template Options</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {Object.entries(messageTemplates).map(([key, label]) => (
                        <Button
                          key={key}
                          variant="outline"
                          size="sm"
                          onClick={() => handleTemplateSelect(key)}
                          className="justify-start h-auto py-2 px-3"
                        >
                          <div className="text-left">
                            <div className="font-medium text-xs">{label.split('\n')[0].replace(/🏢|🔧|💰|🏦/g, '').trim()}</div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message_template">{t("fields.messageTemplate")} *</Label>
                    <Textarea
                      id="message_template"
                      value={formData.message_template}
                      onChange={(e) => handleInputChange("message_template", e.target.value)}
                      placeholder={t("fields.messageTemplatePlaceholder")}
                      rows={6}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="text-xs text-gray-600">
                    <div className="font-medium mb-1">{t("variables.title")}</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                      {["company_name", "today_date", "amount", "employee_count", "vehicle_count"].map(variable => (
                        <Badge key={variable} variant="outline" className="text-xs">
                          {`{{${variable}}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Scheduling Options */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t("createAlert.scheduling")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_recurring"
                      checked={formData.is_recurring}
                      onCheckedChange={(checked) => handleInputChange("is_recurring", checked)}
                    />
                    <Label htmlFor="is_recurring">{t("fields.isRecurring")}</Label>
                  </div>

                  {formData.is_recurring && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                      <div className="space-y-2">
                        <Label htmlFor="recurrence_type">{t("fields.recurrenceType")}</Label>
                        <Select
                          value={formData.recurrence_type}
                          onValueChange={(value) => handleInputChange("recurrence_type", value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">{t("recurrenceTypes.daily")}</SelectItem>
                            <SelectItem value="weekly">{t("recurrenceTypes.weekly")}</SelectItem>
                            <SelectItem value="monthly">{t("recurrenceTypes.monthly")}</SelectItem>
                            <SelectItem value="yearly">{t("recurrenceTypes.yearly")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="recurrence_interval">{t("fields.recurrenceInterval")}</Label>
                        <Input
                          id="recurrence_interval"
                          type="number"
                          min="1"
                          value={formData.recurrence_interval}
                          onChange={(e) => handleInputChange("recurrence_interval", e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => handleInputChange("is_active", checked)}
                    />
                    <Label htmlFor="is_active">{t("fields.isActive")}</Label>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Preview</CardTitle>
                  <CardDescription>
                    This is how your notification will look when sent to WhatsApp
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {renderPreview()}
                </CardContent>
              </Card>
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : notification ? "Update Alert" : "Create Alert"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

