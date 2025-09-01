# 🔔 Notifications System Setup

## 📋 **System Overview**

The Royal Express Fleet Manager now includes a comprehensive notification system that allows you to create automated WhatsApp group alerts based on various triggers including amounts, dates, and scheduled reminders.

## 🎯 **Features Implemented**

### ✅ **Frontend (Complete)**
- ✅ New "Notifications" tab in main navigation
- ✅ **Alert Management Interface** - Create, edit, delete, activate/deactivate alerts
- ✅ **Rich Form UI** with template selection and variable preview
- ✅ **Message Preview** with dynamic variable substitution
- ✅ **Notification History** with filtering and export capabilities
- ✅ **Status Indicators** for active/inactive alerts and delivery status
- ✅ Full i18n support (English/Portuguese)

### ✅ **Backend (Complete)**
- ✅ **Database Schema** - notifications, notification_logs, notification_variables tables
- ✅ **Notification Service** - Complete CRUD operations and template processing
- ✅ **WhatsApp API Integration** - Send messages to groups with delivery tracking
- ✅ **Scheduler API** - Automated triggering of time-based notifications
- ✅ **Dynamic Variables** - Real-time data from financial, HR, and vehicle systems
- ✅ **Webhook Support** - Handle WhatsApp delivery status updates

### ✅ **Alert Types Supported**
1. **Amount Threshold** - Trigger when financial amounts reach thresholds
2. **Date-based Events** - Trigger on specific dates and times
3. **Scheduled Reminders** - Recurring alerts (daily, weekly, monthly, yearly)

## 🔧 **Setup Instructions**

### **1. Database Migration**
Run the database migration to create the notifications tables:
```bash
# The migration file is already created at:
# supabase/migrations/20241221000004_create_notifications_system.sql
```

### **2. Environment Variables**
Add these to your `.env.local` file:

```bash
# WhatsApp Business API Configuration
WHATSAPP_API_URL=https://graph.facebook.com/v17.0
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token

# Cron Job Security (optional)
CRON_SECRET_TOKEN=your_secure_random_token
```

### **3. WhatsApp Business API Setup**
1. Create a WhatsApp Business Account
2. Set up a WhatsApp Business App in Meta for Developers
3. Get your access token and phone number ID
4. Configure webhook URL: `https://yourdomain.com/api/whatsapp`

### **4. Access the Notifications System**
Navigate to: `http://localhost:3000/dashboard/notifications`

## 📁 **Files Created/Modified**

### **New Files:**
- `supabase/migrations/20241221000004_create_notifications_system.sql` - Database schema
- `services/notificationService.ts` - Core notification service
- `app/dashboard/notifications/layout.tsx` - Layout for notifications pages
- `app/dashboard/notifications/page.tsx` - Main notifications interface
- `components/create-notification-dialog.tsx` - Alert creation/editing dialog
- `components/notification-history-table.tsx` - Message history display
- `app/api/whatsapp/route.ts` - WhatsApp API integration
- `app/api/notifications/trigger/route.ts` - Scheduler API endpoint
- `public/locales/en/notifications.json` - English translations
- `public/locales/pt/notifications.json` - Portuguese translations
- `NOTIFICATIONS_SETUP.md` - This documentation

### **Modified Files:**
- `components/sidebar.tsx` - Added Notifications tab to navigation
- `public/locales/en/common.json` - Added notifications navigation item
- `public/locales/pt/common.json` - Added notifications navigation item

## 🎨 **User Interface Features**

### **Alert Management**
- **Create New Alerts** with intuitive form interface
- **Template Selection** with pre-built message templates
- **Variable Preview** showing available dynamic variables
- **Message Preview** with real-time variable substitution
- **Bulk Actions** for activating/deactivating multiple alerts

### **Message Templates**
- **Payroll Reminder** - Monthly payroll processing alerts
- **Maintenance Due** - Overdue maintenance notifications
- **Revenue Target** - Daily financial performance alerts
- **Deposit Reminder** - Pending bank deposit notifications
- **Custom Templates** - User-defined message content

### **Dynamic Variables**
All templates support these variables:
- `{{company_name}}` - Royal Express
- `{{today_date}}` - Current date
- `{{current_time}}` - Current time
- `{{alert_name}}` - Name of the alert
- `{{amount}}` - Threshold amount (for amount-based alerts)
- `{{total_revenue_today}}` - Today's total revenue
- `{{total_expenses_today}}` - Today's total expenses
- `{{net_profit_today}}` - Today's net profit
- `{{employee_count}}` - Number of active employees
- `{{vehicle_count}}` - Number of vehicles
- `{{pending_deposits}}` - Number of pending deposits
- `{{overdue_maintenance}}` - Number of overdue maintenance items

## 🤖 **Automation & Scheduling**

### **Cron Job Setup**
For automated triggering, set up a cron job to call:
```bash
# Every 15 minutes
curl -X POST https://yourdomain.com/api/notifications/trigger \
  -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN"
```

### **Vercel Cron Jobs**
Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/notifications/trigger",
      "schedule": "0 */15 * * * *"
    }
  ]
}
```

### **Manual Triggering**
Test individual notifications:
```bash
# Test a specific notification
GET /api/notifications/trigger?id=notification_id&test=true

# View due notifications
GET /api/notifications/trigger
```

## 📱 **WhatsApp Integration**

### **Group Setup**
1. Create WhatsApp groups for different alert types
2. Add your WhatsApp Business number to the groups
3. Get the group IDs using WhatsApp Business API
4. Configure group IDs in the notification alerts

### **Message Format**
Messages are sent as plain text with emoji support. Example:
```
🏢 Royal Express Payroll Reminder

📅 Date: 2024-01-15
💰 Monthly payroll processing is due.

👥 Employees: 25
📊 Please review and process payroll.
```

## 🌍 **Internationalization**

Full support for:
- **English** - Notifications, alerts, and templates
- **Portuguese** - Notificações, alertas, e modelos

## 🔒 **Security Features**

- **Row Level Security** on all notification tables
- **Authorization tokens** for cron job endpoints
- **Webhook verification** for WhatsApp callbacks
- **Input validation** on all forms and API endpoints

## 📊 **Monitoring & Analytics**

### **Dashboard Statistics**
- Total alerts configured
- Active vs inactive alerts
- Recent message history
- Delivery status tracking

### **Message History**
- Full message log with timestamps
- Delivery status tracking (pending, sent, delivered, failed)
- Filter by status, alert type, or trigger method
- Export to CSV for analysis

## 🚀 **Usage Examples**

### **1. Daily Revenue Alert**
- **Type**: Scheduled Reminder
- **Schedule**: Daily at 6:00 PM
- **Message**: Daily revenue summary with profit/loss
- **Group**: Management Team

### **2. Payroll Reminder**
- **Type**: Date-based Event
- **Date**: Last working day of each month
- **Time**: 9:00 AM
- **Message**: Payroll processing reminder
- **Group**: HR Department

### **3. High Expense Alert**
- **Type**: Amount Threshold
- **Amount**: 500,000 AOA
- **Message**: Alert when daily expenses exceed threshold
- **Group**: Finance Team

### **4. Maintenance Due**
- **Type**: Scheduled Reminder
- **Schedule**: Weekly on Mondays at 8:00 AM
- **Message**: Overdue maintenance summary
- **Group**: Maintenance Team

## 🔍 **Troubleshooting**

### **Common Issues**

1. **WhatsApp Messages Not Sending**
   - Check access token and phone number ID
   - Verify group IDs are correct
   - Check network connectivity

2. **Scheduled Notifications Not Triggering**
   - Ensure cron job is configured correctly
   - Check next_trigger_at timestamps in database
   - Verify notifications are active

3. **Variable Substitution Not Working**
   - Check variable name spelling in templates
   - Ensure database functions are working
   - Verify dynamic variable service

### **Debug Endpoints**
```bash
# Check due notifications
GET /api/notifications/trigger

# Test specific notification
GET /api/notifications/trigger?id=NOTIFICATION_ID&test=true

# View notification logs
GET /dashboard/notifications (History tab)
```

## 📞 **Support**

For issues or questions about the notification system:
1. Check the notifications dashboard for delivery status
2. Review API logs in development console
3. Verify WhatsApp Business API configuration
4. Test with simulated messages first (when API tokens not configured)

---

**System Status**: ✅ Fully implemented and ready for production use

## 🎉 **Ready to Use!**

The notification system is now fully integrated into your Royal Express Fleet Manager. Start by creating your first alert from the Notifications tab in the dashboard!

