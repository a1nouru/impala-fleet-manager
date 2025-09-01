import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// --- Type Definitions ---

export interface Notification {
  id: string;
  name: string;
  description?: string;
  alert_type: 'amount_threshold' | 'date_based' | 'scheduled_reminder';
  
  // Alert conditions
  amount?: number;
  event_date?: string;
  notification_time?: string;
  
  // WhatsApp configuration
  whatsapp_group_id: string;
  whatsapp_group_name: string;
  message_template: string;
  
  // Scheduling configuration
  is_recurring: boolean;
  recurrence_type?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurrence_interval?: number;
  
  // Status and metadata
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  last_triggered_at?: string;
  next_trigger_at?: string;
}

export interface NotificationLog {
  id: string;
  notification_id: string;
  
  // Message details
  message_content: string;
  whatsapp_group_id: string;
  whatsapp_group_name: string;
  
  // Trigger information
  trigger_type: 'manual' | 'scheduled' | 'threshold_met';
  trigger_data?: any;
  
  // Delivery status
  status: 'pending' | 'sent' | 'failed' | 'delivered';
  sent_at?: string;
  delivered_at?: string;
  error_message?: string;
  
  // Metadata
  created_by?: string;
  created_at: string;
  
  // Joined data
  notifications?: {
    name: string;
  };
}

export interface NotificationVariable {
  id: string;
  variable_name: string;
  variable_description: string;
  variable_type: 'text' | 'number' | 'date' | 'currency';
  is_dynamic: boolean;
  default_value?: string;
  created_at: string;
}

export interface CreateNotificationData {
  name: string;
  description?: string;
  alert_type: 'amount_threshold' | 'date_based' | 'scheduled_reminder';
  amount?: number;
  event_date?: string;
  notification_time?: string;
  whatsapp_group_id: string;
  whatsapp_group_name: string;
  message_template: string;
  is_recurring?: boolean;
  recurrence_type?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurrence_interval?: number;
  is_active?: boolean;
  created_by?: string;
}

export interface UpdateNotificationData {
  name?: string;
  description?: string;
  alert_type?: 'amount_threshold' | 'date_based' | 'scheduled_reminder';
  amount?: number;
  event_date?: string;
  notification_time?: string;
  whatsapp_group_id?: string;
  whatsapp_group_name?: string;
  message_template?: string;
  is_recurring?: boolean;
  recurrence_type?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurrence_interval?: number;
  is_active?: boolean;
}

// --- Service Functions ---

export const notificationService = {
  /**
   * Fetches all notifications with pagination and filtering
   */
  async getNotifications(options?: {
    isActive?: boolean;
    alertType?: string;
    limit?: number;
    offset?: number;
  }): Promise<Notification[]> {
    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (options?.isActive !== undefined) {
      query = query.eq('is_active', options.isActive);
    }

    if (options?.alertType) {
      query = query.eq('alert_type', options.alertType);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Fetches a single notification by ID
   */
  async getNotificationById(id: string): Promise<Notification | null> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('Error fetching notification by ID:', error);
      throw error;
    }

    return data;
  },

  /**
   * Creates a new notification
   */
  async createNotification(notificationData: CreateNotificationData): Promise<Notification> {
    const { data, error } = await supabase
      .from('notifications')
      .insert([{
        ...notificationData,
        is_active: notificationData.is_active ?? true,
        is_recurring: notificationData.is_recurring ?? false,
        recurrence_interval: notificationData.recurrence_interval ?? 1
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating notification:', error);
      throw error;
    }

    return data;
  },

  /**
   * Updates an existing notification
   */
  async updateNotification(id: string, updates: UpdateNotificationData): Promise<Notification> {
    const { data, error } = await supabase
      .from('notifications')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating notification:', error);
      throw error;
    }

    return data;
  },

  /**
   * Deletes a notification
   */
  async deleteNotification(id: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  },

  /**
   * Activates a notification
   */
  async activateNotification(id: string): Promise<Notification> {
    return this.updateNotification(id, { is_active: true });
  },

  /**
   * Deactivates a notification
   */
  async deactivateNotification(id: string): Promise<Notification> {
    return this.updateNotification(id, { is_active: false });
  },

  /**
   * Fetches notification logs with filtering and pagination
   */
  async getNotificationLogs(options?: {
    notificationId?: string;
    status?: string;
    triggerType?: string;
    limit?: number;
    offset?: number;
  }): Promise<NotificationLog[]> {
    let query = supabase
      .from('notification_logs')
      .select(`
        *,
        notifications (
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (options?.notificationId) {
      query = query.eq('notification_id', options.notificationId);
    }

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.triggerType) {
      query = query.eq('trigger_type', options.triggerType);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching notification logs:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Creates a notification log entry
   */
  async createNotificationLog(logData: {
    notification_id: string;
    message_content: string;
    whatsapp_group_id: string;
    whatsapp_group_name: string;
    trigger_type: 'manual' | 'scheduled' | 'threshold_met';
    trigger_data?: any;
    status?: 'pending' | 'sent' | 'failed' | 'delivered';
    sent_at?: string;
    delivered_at?: string;
    error_message?: string;
    created_by?: string;
  }): Promise<NotificationLog> {
    const { data, error } = await supabase
      .from('notification_logs')
      .insert([{
        ...logData,
        status: logData.status || 'pending'
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating notification log:', error);
      throw error;
    }

    return data;
  },

  /**
   * Updates a notification log status
   */
  async updateNotificationLogStatus(
    logId: string,
    status: 'pending' | 'sent' | 'failed' | 'delivered',
    options?: {
      sentAt?: string;
      deliveredAt?: string;
      errorMessage?: string;
    }
  ): Promise<void> {
    const updates: any = { status };

    if (options?.sentAt) updates.sent_at = options.sentAt;
    if (options?.deliveredAt) updates.delivered_at = options.deliveredAt;
    if (options?.errorMessage) updates.error_message = options.errorMessage;

    const { error } = await supabase
      .from('notification_logs')
      .update(updates)
      .eq('id', logId);

    if (error) {
      console.error('Error updating notification log status:', error);
      throw error;
    }
  },

  /**
   * Fetches all available notification variables
   */
  async getNotificationVariables(): Promise<NotificationVariable[]> {
    const { data, error } = await supabase
      .from('notification_variables')
      .select('*')
      .order('variable_name');

    if (error) {
      console.error('Error fetching notification variables:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Fetches notifications that need to be triggered (for scheduler)
   */
  async getNotificationsDueForTrigger(): Promise<Notification[]> {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('is_active', true)
      .lte('next_trigger_at', now)
      .not('next_trigger_at', 'is', null);

    if (error) {
      console.error('Error fetching notifications due for trigger:', error);
      throw error;
    }

    return data || [];
  },

  /**
   * Updates the last triggered time for a notification
   */
  async updateLastTriggered(id: string): Promise<void> {
    const now = new Date().toISOString();
    
    const { error } = await supabase
      .from('notifications')
      .update({ last_triggered_at: now })
      .eq('id', id);

    if (error) {
      console.error('Error updating last triggered time:', error);
      throw error;
    }
  },

  /**
   * Processes template variables in message content
   */
  processMessageTemplate(template: string, variables: Record<string, any>): string {
    let processedMessage = template;

    // Replace all variables in the format {{variable_name}}
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      processedMessage = processedMessage.replace(regex, String(value || ''));
    }

    return processedMessage;
  },

  /**
   * Fetches dynamic variable values (revenue, expenses, etc.)
   */
  async getDynamicVariableValues(): Promise<Record<string, any>> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();

      // Fetch financial data for today
      const { data: financialData } = await supabase.rpc('get_kpi_metrics', {
        start_date: today,
        end_date: today
      });

      // Fetch other counts
      const [
        { count: employeeCount },
        { count: vehicleCount },
        { count: pendingDeposits },
        { count: overdueMaintenanceCount }
      ] = await Promise.all([
        supabase.from('employees').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('vehicles').select('*', { count: 'exact', head: true }),
        supabase.from('bank_deposits').select('*', { count: 'exact', head: true }).is('deposit_slip_url', null),
        supabase.from('daily_reports').select('*', { count: 'exact', head: true })
          .eq('status', 'Non-Operational').gte('report_date', today)
      ]);

      return {
        company_name: 'Royal Express',
        today_date: today,
        current_time: now.toTimeString().split(' ')[0],
        total_revenue_today: financialData?.total_revenue || 0,
        total_expenses_today: financialData?.total_expenses || 0,
        net_profit_today: financialData?.net_profit || 0,
        employee_count: employeeCount || 0,
        vehicle_count: vehicleCount || 0,
        pending_deposits: pendingDeposits || 0,
        overdue_maintenance: overdueMaintenanceCount || 0
      };
    } catch (error) {
      console.error('Error fetching dynamic variable values:', error);
      return {
        company_name: 'Royal Express',
        today_date: new Date().toISOString().split('T')[0],
        current_time: new Date().toTimeString().split(' ')[0],
        total_revenue_today: 0,
        total_expenses_today: 0,
        net_profit_today: 0,
        employee_count: 0,
        vehicle_count: 0,
        pending_deposits: 0,
        overdue_maintenance: 0
      };
    }
  }
};

