import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { updateEmailLogStatus } from '@/lib/email'

// Resend webhook event types
type ResendEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.delivery_delayed'
  | 'email.complained'
  | 'email.bounced'
  | 'email.opened'
  | 'email.clicked'

interface ResendWebhookPayload {
  type: ResendEventType
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    created_at: string
  }
}

// Map Resend event types to our status values
function mapEventToStatus(
  eventType: ResendEventType
): 'sent' | 'delivered' | 'bounced' | 'complained' | 'opened' | 'clicked' | null {
  switch (eventType) {
    case 'email.sent':
      return 'sent'
    case 'email.delivered':
      return 'delivered'
    case 'email.bounced':
      return 'bounced'
    case 'email.complained':
      return 'complained'
    case 'email.opened':
      return 'opened'
    case 'email.clicked':
      return 'clicked'
    case 'email.delivery_delayed':
      return null // Don't update status for delays
    default:
      return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const headers = Object.fromEntries(request.headers.entries())

    // Verify webhook signature if signing secret is configured
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
    if (webhookSecret) {
      const svix = new Webhook(webhookSecret)
      try {
        svix.verify(body, {
          'svix-id': headers['svix-id'] || '',
          'svix-timestamp': headers['svix-timestamp'] || '',
          'svix-signature': headers['svix-signature'] || '',
        })
      } catch {
        console.error('Invalid webhook signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const payload = JSON.parse(body) as ResendWebhookPayload

    // Map event type to our status
    const status = mapEventToStatus(payload.type)
    if (!status) {
      // Event type we don't track, acknowledge receipt
      return NextResponse.json({ received: true })
    }

    // Update the email log
    const resendId = payload.data.email_id
    const timestamp = payload.created_at

    const success = await updateEmailLogStatus(resendId, status, timestamp)

    if (!success) {
      // Log not found or update failed - still return 200 to prevent retries
      console.warn(`Failed to update email log for resend_id: ${resendId}`)
    }

    return NextResponse.json({ received: true, updated: success })
  } catch (error) {
    console.error('Webhook processing error:', error)
    // Return 200 to prevent Resend from retrying on parsing errors
    return NextResponse.json({ received: true, error: 'Processing failed' })
  }
}

// Resend may send OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, svix-id, svix-timestamp, svix-signature',
    },
  })
}
