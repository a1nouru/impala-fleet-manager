import { NextRequest, NextResponse } from 'next/server';
import { notificationService } from '@/services/notificationService';

// WhatsApp Business API configuration
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v17.0';
const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

interface WhatsAppMessage {
  messaging_product: "whatsapp";
  to: string;
  type: "text";
  text: {
    body: string;
  };
}

interface SendMessageRequest {
  groupId: string;
  message: string;
  notificationId?: string;
  triggerType: 'manual' | 'scheduled' | 'threshold_met';
  triggerData?: any;
}

export async function POST(request: NextRequest) {
  try {
    const body: SendMessageRequest = await request.json();
    const { groupId, message, notificationId, triggerType, triggerData } = body;

    // Validate required fields
    if (!groupId || !message) {
      return NextResponse.json(
        { error: 'Group ID and message are required' },
        { status: 400 }
      );
    }

    // Create log entry first
    let logId: string | null = null;
    if (notificationId) {
      try {
        const notification = await notificationService.getNotificationById(notificationId);
        if (notification) {
          const log = await notificationService.createNotificationLog({
            notification_id: notificationId,
            message_content: message,
            whatsapp_group_id: groupId,
            whatsapp_group_name: notification.whatsapp_group_name,
            trigger_type: triggerType,
            trigger_data: triggerData,
            status: 'pending'
          });
          logId = log.id;
        }
      } catch (error) {
        console.error('Error creating notification log:', error);
      }
    }

    // For development/testing without WhatsApp API
    if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      console.log('🔧 WhatsApp API not configured - simulating message send');
      console.log('📱 Group ID:', groupId);
      console.log('💬 Message:', message);
      
      // Simulate successful send
      if (logId) {
        await notificationService.updateNotificationLogStatus(logId, 'sent', {
          sentAt: new Date().toISOString()
        });
        
        // Simulate delivery after a short delay
        setTimeout(async () => {
          try {
            await notificationService.updateNotificationLogStatus(logId!, 'delivered', {
              deliveredAt: new Date().toISOString()
            });
          } catch (error) {
            console.error('Error updating delivery status:', error);
          }
        }, 2000);
      }

      return NextResponse.json({
        success: true,
        messageId: `sim_${Date.now()}`,
        status: 'sent',
        message: 'Message simulated successfully (WhatsApp API not configured)'
      });
    }

    try {
      // Prepare WhatsApp message
      const whatsappMessage: WhatsAppMessage = {
        messaging_product: "whatsapp",
        to: groupId,
        type: "text",
        text: {
          body: message
        }
      };

      // Send message to WhatsApp API
      const response = await fetch(`${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(whatsappMessage)
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error('WhatsApp API error:', responseData);
        
        // Update log status to failed
        if (logId) {
          await notificationService.updateNotificationLogStatus(logId, 'failed', {
            errorMessage: responseData.error?.message || 'Failed to send message'
          });
        }

        return NextResponse.json(
          { 
            error: 'Failed to send WhatsApp message', 
            details: responseData.error?.message || 'Unknown error'
          },
          { status: 500 }
        );
      }

      // Update log status to sent
      if (logId) {
        await notificationService.updateNotificationLogStatus(logId, 'sent', {
          sentAt: new Date().toISOString()
        });
      }

      return NextResponse.json({
        success: true,
        messageId: responseData.messages?.[0]?.id,
        status: 'sent',
        message: 'Message sent successfully'
      });

    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      
      // Update log status to failed
      if (logId) {
        await notificationService.updateNotificationLogStatus(logId, 'failed', {
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in WhatsApp API route:', error);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}

// Webhook endpoint for WhatsApp delivery status updates
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Verify webhook (required by WhatsApp)
  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ WhatsApp webhook verified');
    return new NextResponse(challenge);
  }

  return NextResponse.json({ error: 'Webhook verification failed' }, { status: 403 });
}

// Handle WhatsApp webhook notifications (delivery status, etc.)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Process WhatsApp webhook notifications
    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'messages') {
            const value = change.value;
            
            // Handle message status updates
            if (value.statuses) {
              for (const status of value.statuses) {
                const messageId = status.id;
                const statusType = status.status; // sent, delivered, read, failed
                
                console.log(`📱 WhatsApp status update: ${messageId} -> ${statusType}`);
                
                // Here you could update the notification log status based on the message ID
                // This would require storing the WhatsApp message ID in the notification log
                
                if (statusType === 'delivered') {
                  // Update any matching notification logs to delivered status
                  // This is a simplified approach - in production you'd match by message ID
                  console.log('✅ Message delivered successfully');
                } else if (statusType === 'failed') {
                  console.log('❌ Message delivery failed');
                }
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing WhatsApp webhook:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

