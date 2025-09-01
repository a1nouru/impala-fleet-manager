import { NextRequest, NextResponse } from 'next/server';
import { notificationService } from '@/services/notificationService';

// This endpoint can be called by a cron job service like Vercel Cron or external schedulers
export async function POST(request: NextRequest) {
  try {
    // Verify the request is from an authorized source (optional)
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET_TOKEN;
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🔄 Checking for notifications to trigger...');

    // Get notifications that are due for triggering
    const dueNotifications = await notificationService.getNotificationsDueForTrigger();
    
    if (dueNotifications.length === 0) {
      console.log('✅ No notifications due for triggering');
      return NextResponse.json({
        success: true,
        message: 'No notifications due for triggering',
        triggered: 0
      });
    }

    console.log(`📅 Found ${dueNotifications.length} notifications due for triggering`);

    const results = [];
    
    for (const notification of dueNotifications) {
      try {
        console.log(`🔔 Processing notification: ${notification.name}`);

        // Get dynamic variable values
        const dynamicVars = await notificationService.getDynamicVariableValues();
        
        // Process the message template
        const processedMessage = notificationService.processMessageTemplate(
          notification.message_template,
          {
            ...dynamicVars,
            alert_name: notification.name,
            amount: notification.amount || 0,
            event_date: notification.event_date || dynamicVars.today_date
          }
        );

        // Send the WhatsApp message
        const whatsappResponse = await fetch(`${request.nextUrl.origin}/api/whatsapp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            groupId: notification.whatsapp_group_id,
            message: processedMessage,
            notificationId: notification.id,
            triggerType: 'scheduled',
            triggerData: {
              triggeredAt: new Date().toISOString(),
              nextTriggerAt: notification.next_trigger_at
            }
          })
        });

        const whatsappResult = await whatsappResponse.json();

        if (whatsappResult.success) {
          // Update the last triggered time
          await notificationService.updateLastTriggered(notification.id);
          
          console.log(`✅ Successfully triggered notification: ${notification.name}`);
          results.push({
            notificationId: notification.id,
            notificationName: notification.name,
            status: 'success',
            messageId: whatsappResult.messageId
          });
        } else {
          console.error(`❌ Failed to trigger notification: ${notification.name}`, whatsappResult.error);
          results.push({
            notificationId: notification.id,
            notificationName: notification.name,
            status: 'failed',
            error: whatsappResult.error
          });
        }

      } catch (error) {
        console.error(`❌ Error processing notification ${notification.name}:`, error);
        results.push({
          notificationId: notification.id,
          notificationName: notification.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failureCount = results.length - successCount;

    console.log(`📊 Trigger summary: ${successCount} successful, ${failureCount} failed`);

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} notifications`,
      triggered: successCount,
      failed: failureCount,
      results
    });

  } catch (error) {
    console.error('❌ Error in notification trigger endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint for manual triggering or testing
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('id');
    const test = searchParams.get('test') === 'true';

    if (notificationId) {
      // Trigger a specific notification
      const notification = await notificationService.getNotificationById(notificationId);
      
      if (!notification) {
        return NextResponse.json(
          { error: 'Notification not found' },
          { status: 404 }
        );
      }

      if (!notification.is_active && !test) {
        return NextResponse.json(
          { error: 'Notification is not active' },
          { status: 400 }
        );
      }

      try {
        // Get dynamic variable values
        const dynamicVars = await notificationService.getDynamicVariableValues();
        
        // Process the message template
        const processedMessage = notificationService.processMessageTemplate(
          notification.message_template,
          {
            ...dynamicVars,
            alert_name: notification.name,
            amount: notification.amount || 0,
            event_date: notification.event_date || dynamicVars.today_date
          }
        );

        // Send the WhatsApp message
        const whatsappResponse = await fetch(`${request.nextUrl.origin}/api/whatsapp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            groupId: notification.whatsapp_group_id,
            message: processedMessage,
            notificationId: notification.id,
            triggerType: 'manual',
            triggerData: {
              triggeredAt: new Date().toISOString(),
              triggeredBy: 'manual'
            }
          })
        });

        const whatsappResult = await whatsappResponse.json();

        if (whatsappResult.success) {
          if (!test) {
            await notificationService.updateLastTriggered(notification.id);
          }
          
          return NextResponse.json({
            success: true,
            message: `Notification "${notification.name}" triggered successfully`,
            messageId: whatsappResult.messageId,
            processedMessage
          });
        } else {
          return NextResponse.json(
            { 
              error: 'Failed to send WhatsApp message',
              details: whatsappResult.error
            },
            { status: 500 }
          );
        }

      } catch (error) {
        console.error('Error triggering specific notification:', error);
        return NextResponse.json(
          { 
            error: 'Failed to trigger notification',
            details: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 500 }
        );
      }
    } else {
      // Get all due notifications (for debugging)
      const dueNotifications = await notificationService.getNotificationsDueForTrigger();
      
      return NextResponse.json({
        dueNotifications: dueNotifications.map(n => ({
          id: n.id,
          name: n.name,
          alert_type: n.alert_type,
          next_trigger_at: n.next_trigger_at,
          is_active: n.is_active
        }))
      });
    }

  } catch (error) {
    console.error('Error in GET notification trigger endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

