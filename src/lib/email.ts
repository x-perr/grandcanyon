import { Resend } from 'resend'

// Lazy initialization to avoid crashing when API key is not set
let resend: Resend | null = null

function getResend(): Resend {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set')
    }
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

export interface SendInvoiceEmailParams {
  to: string
  invoiceNumber: string
  clientName: string
  total: string
  dueDate: string
  pdfBuffer: Buffer
  customMessage?: string
  companyName?: string
  companyEmail?: string
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
  subject: string
  body: string
}

/**
 * Send invoice email with PDF attachment
 */
export async function sendInvoiceEmail(params: SendInvoiceEmailParams): Promise<SendEmailResult> {
  const {
    to,
    invoiceNumber,
    clientName,
    total,
    dueDate,
    pdfBuffer,
    customMessage,
    companyName = 'Systèmes Intérieurs Grand Canyon',
    companyEmail = 'comptabilite@grandcanyon.ca',
  } = params

  const subject = `Facture ${invoiceNumber} / Invoice ${invoiceNumber}`
  const body = generateInvoiceEmailBody({
    clientName,
    invoiceNumber,
    total,
    dueDate,
    customMessage,
    companyName,
    companyEmail,
  })

  try {
    const result = await getResend().emails.send({
      from: `${companyName} <invoices@grandcanyon.ca>`,
      to,
      replyTo: companyEmail,
      subject,
      html: body,
      attachments: [
        {
          filename: `INV-${invoiceNumber}.pdf`,
          content: pdfBuffer,
        },
      ],
    })

    if (result.error) {
      return {
        success: false,
        error: result.error.message,
        subject,
        body,
      }
    }

    return {
      success: true,
      messageId: result.data?.id,
      subject,
      body,
    }
  } catch (error) {
    console.error('Error sending invoice email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
      subject,
      body,
    }
  }
}

// === TIMESHEET REMINDER EMAILS ===

export interface SendTimesheetReminderParams {
  to: string
  employeeName: string
  weekRange: string
  dueDate: string
  companyName?: string
  companyEmail?: string
}

/**
 * Send timesheet reminder email to an employee
 */
export async function sendTimesheetReminder(params: SendTimesheetReminderParams): Promise<{
  success: boolean
  error?: string
}> {
  const {
    to,
    employeeName,
    weekRange,
    dueDate,
    companyName = 'Systèmes Intérieurs Grand Canyon',
    companyEmail = 'admin@grandcanyon.ca',
  } = params

  const subject = `Rappel: Feuille de temps / Timesheet Reminder - ${weekRange}`
  const body = generateTimesheetReminderBody({
    employeeName,
    weekRange,
    dueDate,
    companyName,
    companyEmail,
  })

  try {
    const result = await getResend().emails.send({
      from: `${companyName} <timesheets@grandcanyon.ca>`,
      to,
      replyTo: companyEmail,
      subject,
      html: body,
    })

    if (result.error) {
      return { success: false, error: result.error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Error sending timesheet reminder:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    }
  }
}

/**
 * Generate bilingual HTML body for timesheet reminder
 */
function generateTimesheetReminderBody(params: {
  employeeName: string
  weekRange: string
  dueDate: string
  companyName: string
  companyEmail: string
}): string {
  const { employeeName, weekRange, dueDate, companyName, companyEmail } = params

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #fef3c7; border-radius: 8px; padding: 30px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
    <h1 style="margin: 0 0 10px 0; color: #1a1a1a; font-size: 24px;">
      ⏰ Rappel de feuille de temps
    </h1>
    <p style="margin: 0; color: #666; font-size: 14px;">
      Timesheet Reminder
    </p>
  </div>

  <p style="margin-bottom: 20px;">Bonjour ${employeeName},</p>

  <p style="margin-bottom: 20px;">
    Ce message est un rappel amical que votre feuille de temps pour la semaine du <strong>${weekRange}</strong> n'a pas encore été soumise.
    <br><br>
    <span style="color: #666;">This is a friendly reminder that your timesheet for the week of <strong>${weekRange}</strong> has not been submitted yet.</span>
  </p>

  <table style="width: 100%; border-collapse: collapse; margin: 25px 0; background-color: #f8f9fa; border-radius: 8px; overflow: hidden;">
    <tr>
      <td style="padding: 15px 20px; border-bottom: 1px solid #e9ecef;">
        <strong>Semaine / Week</strong>
      </td>
      <td style="padding: 15px 20px; border-bottom: 1px solid #e9ecef; text-align: right; font-weight: bold;">
        ${weekRange}
      </td>
    </tr>
    <tr>
      <td style="padding: 15px 20px;">
        <strong>Date limite / Due Date</strong>
      </td>
      <td style="padding: 15px 20px; text-align: right; color: #dc2626; font-weight: bold;">
        ${dueDate}
      </td>
    </tr>
  </table>

  <p style="margin: 25px 0;">
    Veuillez soumettre votre feuille de temps dès que possible.<br>
    <span style="color: #666;">Please submit your timesheet as soon as possible.</span>
  </p>

  <p style="margin-bottom: 30px; color: #666;">
    Merci de votre collaboration!<br>
    <span style="color: #999;">Thank you for your cooperation!</span>
  </p>

  <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">

  <p style="font-size: 12px; color: #666; margin: 0;">
    ${companyName}<br>
    <a href="mailto:${companyEmail}" style="color: #0066cc;">${companyEmail}</a>
  </p>
</body>
</html>
  `.trim()
}

/**
 * Generate bilingual HTML email body
 */
function generateInvoiceEmailBody(params: {
  clientName: string
  invoiceNumber: string
  total: string
  dueDate: string
  customMessage?: string
  companyName: string
  companyEmail: string
}): string {
  const { clientName, invoiceNumber, total, dueDate, customMessage, companyName, companyEmail } =
    params

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h1 style="margin: 0 0 10px 0; color: #1a1a1a; font-size: 24px;">
      Facture ${invoiceNumber}
    </h1>
    <p style="margin: 0; color: #666; font-size: 14px;">
      Invoice ${invoiceNumber}
    </p>
  </div>

  <p style="margin-bottom: 20px;">Bonjour / Hello,</p>

  <p style="margin-bottom: 20px;">
    Veuillez trouver ci-joint la facture <strong>${invoiceNumber}</strong> pour <strong>${clientName}</strong>.
    <br>
    <span style="color: #666;">Please find attached invoice <strong>${invoiceNumber}</strong> for <strong>${clientName}</strong>.</span>
  </p>

  <table style="width: 100%; border-collapse: collapse; margin: 25px 0; background-color: #f8f9fa; border-radius: 8px; overflow: hidden;">
    <tr>
      <td style="padding: 15px 20px; border-bottom: 1px solid #e9ecef;">
        <strong>Montant / Amount</strong>
      </td>
      <td style="padding: 15px 20px; border-bottom: 1px solid #e9ecef; text-align: right; font-size: 18px; font-weight: bold; color: #1a1a1a;">
        ${total}
      </td>
    </tr>
    <tr>
      <td style="padding: 15px 20px;">
        <strong>Échéance / Due Date</strong>
      </td>
      <td style="padding: 15px 20px; text-align: right;">
        ${dueDate}
      </td>
    </tr>
  </table>

  ${
    customMessage
      ? `
  <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
    <p style="margin: 0;">${customMessage}</p>
  </div>
  `
      : ''
  }

  <p style="margin: 25px 0;">
    <strong>Termes:</strong> Net 30 jours / <strong>Terms:</strong> Net 30 days
  </p>

  <p style="margin-bottom: 30px; color: #666;">
    Merci de votre confiance!<br>
    <span style="color: #999;">Thank you for your business!</span>
  </p>

  <hr style="border: none; border-top: 1px solid #e9ecef; margin: 30px 0;">

  <p style="font-size: 12px; color: #666; margin: 0;">
    ${companyName}<br>
    <a href="mailto:${companyEmail}" style="color: #0066cc;">${companyEmail}</a>
  </p>
</body>
</html>
  `.trim()
}
