-- Create notifications system tables for WhatsApp group alerts

-- Enable RLS
SET row_security = on;

-- Create notifications table for alert definitions
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL, -- Alert name/title
    description TEXT, -- Optional description
    alert_type TEXT NOT NULL CHECK (alert_type IN ('amount_threshold', 'date_based', 'scheduled_reminder')),
    
    -- Alert conditions
    amount DECIMAL(12,2), -- For amount-based alerts
    event_date DATE, -- For date-based alerts
    notification_time TIME, -- Time to send notification
    
    -- WhatsApp configuration
    whatsapp_group_id TEXT NOT NULL, -- WhatsApp group identifier
    whatsapp_group_name TEXT NOT NULL, -- Human-readable group name
    message_template TEXT NOT NULL, -- Message template with variables
    
    -- Scheduling configuration
    is_recurring BOOLEAN DEFAULT false,
    recurrence_type TEXT CHECK (recurrence_type IN ('daily', 'weekly', 'monthly', 'yearly')),
    recurrence_interval INTEGER DEFAULT 1, -- Every N days/weeks/months/years
    
    -- Status and metadata
    is_active BOOLEAN DEFAULT true,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    next_trigger_at TIMESTAMP WITH TIME ZONE
);

-- Create notification_logs table for tracking sent messages
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    
    -- Message details
    message_content TEXT NOT NULL, -- Final message sent
    whatsapp_group_id TEXT NOT NULL,
    whatsapp_group_name TEXT NOT NULL,
    
    -- Trigger information
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'scheduled', 'threshold_met')),
    trigger_data JSONB, -- Additional data about what triggered the alert
    
    -- Delivery status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    
    -- Metadata
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notification_variables table for available template variables
CREATE TABLE IF NOT EXISTS notification_variables (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    variable_name TEXT NOT NULL UNIQUE, -- e.g., 'company_name', 'today_date', 'total_revenue'
    variable_description TEXT NOT NULL, -- Human-readable description
    variable_type TEXT NOT NULL CHECK (variable_type IN ('text', 'number', 'date', 'currency')),
    is_dynamic BOOLEAN DEFAULT false, -- True if value is calculated at runtime
    default_value TEXT, -- Static default value if not dynamic
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_active ON notifications(is_active);
CREATE INDEX IF NOT EXISTS idx_notifications_next_trigger ON notifications(next_trigger_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(alert_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_notification ON notification_logs(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created ON notification_logs(created_at);

-- Create updated_at trigger for notifications
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_notifications_updated_at
BEFORE UPDATE ON notifications
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Insert default notification variables
INSERT INTO notification_variables (variable_name, variable_description, variable_type, is_dynamic) VALUES
('company_name', 'Company name (Royal Express)', 'text', false),
('today_date', 'Current date', 'date', true),
('current_time', 'Current time', 'text', true),
('alert_name', 'Name of the alert being triggered', 'text', true),
('amount', 'Amount value for threshold alerts', 'currency', true),
('event_date', 'Date of the event', 'date', true),
('total_revenue_today', 'Total revenue for today', 'currency', true),
('total_expenses_today', 'Total expenses for today', 'currency', true),
('net_profit_today', 'Net profit for today', 'currency', true),
('pending_deposits', 'Number of pending deposits', 'number', true),
('overdue_maintenance', 'Number of overdue maintenance items', 'number', true),
('employee_count', 'Total number of active employees', 'number', true),
('vehicle_count', 'Total number of vehicles', 'number', true)
ON CONFLICT (variable_name) DO NOTHING;

-- Set up Row Level Security policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_variables ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for notifications (allow all authenticated users for now)
DO $$
BEGIN
    -- Notifications policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Enable read access for all users') THEN
        CREATE POLICY "Enable read access for all users" ON notifications FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Enable insert for all users') THEN
        CREATE POLICY "Enable insert for all users" ON notifications FOR INSERT WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Enable update for all users') THEN
        CREATE POLICY "Enable update for all users" ON notifications FOR UPDATE USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Enable delete for all users') THEN
        CREATE POLICY "Enable delete for all users" ON notifications FOR DELETE USING (true);
    END IF;

    -- Notification logs policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_logs' AND policyname = 'Enable read access for all users') THEN
        CREATE POLICY "Enable read access for all users" ON notification_logs FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_logs' AND policyname = 'Enable insert for all users') THEN
        CREATE POLICY "Enable insert for all users" ON notification_logs FOR INSERT WITH CHECK (true);
    END IF;

    -- Notification variables policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notification_variables' AND policyname = 'Enable read access for all users') THEN
        CREATE POLICY "Enable read access for all users" ON notification_variables FOR SELECT USING (true);
    END IF;
END $$;

-- Create function to calculate next trigger time for recurring notifications
CREATE OR REPLACE FUNCTION calculate_next_trigger(
    base_date TIMESTAMP WITH TIME ZONE,
    recurrence_type TEXT,
    recurrence_interval INTEGER
) RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    CASE recurrence_type
        WHEN 'daily' THEN
            RETURN base_date + (recurrence_interval || ' days')::INTERVAL;
        WHEN 'weekly' THEN
            RETURN base_date + (recurrence_interval || ' weeks')::INTERVAL;
        WHEN 'monthly' THEN
            RETURN base_date + (recurrence_interval || ' months')::INTERVAL;
        WHEN 'yearly' THEN
            RETURN base_date + (recurrence_interval || ' years')::INTERVAL;
        ELSE
            RETURN NULL;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Create function to update next_trigger_at when notification is modified
CREATE OR REPLACE FUNCTION update_next_trigger_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_recurring AND NEW.recurrence_type IS NOT NULL THEN
        -- Calculate next trigger based on current time or last triggered time
        NEW.next_trigger_at := calculate_next_trigger(
            COALESCE(NEW.last_triggered_at, NOW()),
            NEW.recurrence_type,
            NEW.recurrence_interval
        );
    ELSIF NEW.event_date IS NOT NULL AND NEW.notification_time IS NOT NULL THEN
        -- For date-based alerts, set next trigger to the specific date and time
        NEW.next_trigger_at := NEW.event_date + NEW.notification_time;
    ELSE
        NEW.next_trigger_at := NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update next_trigger_at
CREATE TRIGGER trigger_update_next_trigger_at
    BEFORE INSERT OR UPDATE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_next_trigger_at();

