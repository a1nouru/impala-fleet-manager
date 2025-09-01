"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Bell, 
  Plus, 
  Settings, 
  History, 
  AlertTriangle,
  CheckCircle,
  Clock,
  MessageSquare,
  Edit,
  Trash2,
  Power,
  PowerOff,
  TestTube
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { notificationService, type Notification, type NotificationLog } from "@/services/notificationService";
import { CreateNotificationDialog } from "@/components/create-notification-dialog";
import { NotificationHistoryTable } from "@/components/notification-history-table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function NotificationsPage() {
  const { t } = useTranslation("notifications");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null);

  // Fetch notifications and logs
  const fetchData = async () => {
    try {
      setLoading(true);
      const [notificationsData, logsData] = await Promise.all([
        notificationService.getNotifications(),
        notificationService.getNotificationLogs({ limit: 50 })
      ]);
      setNotifications(notificationsData);
      setNotificationLogs(logsData);
    } catch (error) {
      console.error("Error fetching notification data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Calculate statistics
  const activeAlerts = notifications.filter(n => n.is_active).length;
  const inactiveAlerts = notifications.filter(n => !n.is_active).length;
  const recentLogs = notificationLogs.slice(0, 10);

  // Handle notification actions
  const handleToggleActive = async (notification: Notification) => {
    try {
      if (notification.is_active) {
        await notificationService.deactivateNotification(notification.id);
      } else {
        await notificationService.activateNotification(notification.id);
      }
      await fetchData();
    } catch (error) {
      console.error("Error toggling notification:", error);
    }
  };

  const handleDeleteNotification = async (notification: Notification) => {
    try {
      await notificationService.deleteNotification(notification.id);
      await fetchData();
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const handleTestNotification = async (notification: Notification) => {
    try {
      // Create a test log entry
      const dynamicVars = await notificationService.getDynamicVariableValues();
      const processedMessage = notificationService.processMessageTemplate(
        notification.message_template,
        {
          ...dynamicVars,
          alert_name: notification.name,
          amount: notification.amount || 0,
          event_date: notification.event_date || dynamicVars.today_date
        }
      );

      await notificationService.createNotificationLog({
        notification_id: notification.id,
        message_content: processedMessage,
        whatsapp_group_id: notification.whatsapp_group_id,
        whatsapp_group_name: notification.whatsapp_group_name,
        trigger_type: 'manual',
        status: 'sent',
        sent_at: new Date().toISOString()
      });

      await fetchData();
      // In a real implementation, this would send to WhatsApp API
      alert(t("messages.testMessageSent"));
    } catch (error) {
      console.error("Error sending test notification:", error);
    }
  };

  const getStatusIcon = (notification: Notification) => {
    if (!notification.is_active) {
      return <PowerOff className="h-4 w-4 text-gray-400" />;
    }
    
    const now = new Date();
    const nextTrigger = notification.next_trigger_at ? new Date(notification.next_trigger_at) : null;
    
    if (nextTrigger && nextTrigger <= now) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
    
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getAlertTypeColor = (type: string) => {
    switch (type) {
      case 'amount_threshold':
        return 'bg-blue-100 text-blue-800';
      case 'date_based':
        return 'bg-green-100 text-green-800';
      case 'scheduled_reminder':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="h-6 w-6" />
            {t("title")}
          </h1>
          <p className="text-gray-600 mt-1">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {t("alerts.createAlert")}
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("alerts.title")}</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notifications.length}</div>
            <p className="text-xs text-muted-foreground">
              {t("alerts.alertCount", { count: notifications.length })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("status.active")}</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeAlerts}</div>
            <p className="text-xs text-muted-foreground">
              {t("alerts.activeAlerts", { count: activeAlerts })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("status.inactive")}</CardTitle>
            <PowerOff className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{inactiveAlerts}</div>
            <p className="text-xs text-muted-foreground">
              {t("alerts.inactiveAlerts", { count: inactiveAlerts })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="alerts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            {t("navigation.alerts")}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            {t("navigation.history")}
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            {t("navigation.settings")}
          </TabsTrigger>
        </TabsList>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          {notifications.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Bell className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">{t("alerts.noAlerts")}</h3>
                <Button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  {t("alerts.createAlert")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {notifications.map((notification) => (
                <Card key={notification.id} className={`${!notification.is_active ? 'opacity-60' : ''}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                          {getStatusIcon(notification)}
                          {notification.name}
                          <Badge className={getAlertTypeColor(notification.alert_type)}>
                            {t(`alertTypes.${notification.alert_type}`)}
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          {notification.description}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestNotification(notification)}
                          title={t("alerts.testAlert")}
                        >
                          <TestTube className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingNotification(notification)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(notification)}
                          title={notification.is_active ? t("alerts.deactivateAlert") : t("alerts.activateAlert")}
                        >
                          {notification.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("alerts.deleteAlert")}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("messages.deleteConfirmation")}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("buttons.cancel", { ns: "common" })}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteNotification(notification)}>
                                {t("buttons.delete", { ns: "common" })}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="font-medium text-gray-700">{t("table.group")}</div>
                        <div className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {notification.whatsapp_group_name}
                        </div>
                      </div>
                      {notification.amount && (
                        <div>
                          <div className="font-medium text-gray-700">{t("fields.amount")}</div>
                          <div>{notification.amount.toLocaleString()} AOA</div>
                        </div>
                      )}
                      {notification.event_date && (
                        <div>
                          <div className="font-medium text-gray-700">{t("fields.eventDate")}</div>
                          <div>{new Date(notification.event_date).toLocaleDateString()}</div>
                        </div>
                      )}
                      {notification.next_trigger_at && (
                        <div>
                          <div className="font-medium text-gray-700">{t("table.nextTrigger")}</div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(notification.next_trigger_at).toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <NotificationHistoryTable logs={notificationLogs} onRefresh={fetchData} />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>{t("navigation.settings")}</CardTitle>
              <CardDescription>
                WhatsApp integration settings and notification preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Settings panel coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <CreateNotificationDialog
        open={isCreateDialogOpen || !!editingNotification}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditingNotification(null);
          }
        }}
        notification={editingNotification}
        onNotificationSaved={fetchData}
      />
    </div>
  );
}

