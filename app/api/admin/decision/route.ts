import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { getServiceClient, getAuthClient } from '@/lib/supabase'

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })
}

async function sendDecisionEmail(
  to: string,
  candidateName: string,
  decision: 'accept' | 'reject'
): Promise<boolean> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return false

  const firstName = candidateName.split(' ')[0]

  const subject = decision === 'accept'
    ? `Congratulations ${firstName} — You've Advanced to the Next Round at Cuemath!`
    : `Update on Your Cuemath Tutor Application`

  const bodyHtml = decision === 'accept'
    ? `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F0EFFA;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0EFFA;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(13,13,26,0.10);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#16A34A 0%,#22C55E 100%);padding:32px 36px;">
            <div style="display:inline-block;background:rgba(255,255,255,0.18);padding:6px 14px;border-radius:8px;font-size:13px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">CUEMATH</div>
            <h1 style="margin:20px 0 4px;font-size:26px;font-weight:800;color:#ffffff;line-height:1.25;">Great news, ${firstName}! 🎉</h1>
            <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.88);line-height:1.5;">You've successfully cleared the AI Screening Round.</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 36px;">
            <p style="margin:0 0 16px;font-size:15px;color:#3D3A5C;line-height:1.65;">
              Hi ${firstName}, congratulations! After reviewing your AI screening interview, the Cuemath hiring team is pleased to inform you that you've been shortlisted and will be advancing to the next stage of our recruitment process.
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#3D3A5C;line-height:1.65;">
              Your communication style, teaching aptitude, and approach stood out to our evaluation team. We're excited about the possibility of you joining the Cuemath family.
            </p>

            <!-- Next steps -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:14px;margin-bottom:24px;">
              <tr><td style="padding:22px 24px;">
                <p style="margin:0 0 14px;font-size:12px;font-weight:700;color:#15803D;text-transform:uppercase;letter-spacing:1px;">What happens next</p>
                ${[
                  'A member of the Cuemath HR team will contact you within <strong>2–3 business days</strong> with next steps.',
                  'You may be invited for a live interview or trial teaching session.',
                  'Keep an eye on your inbox — including spam — for further communication.',
                ].map(text => `
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
                  <tr>
                    <td style="width:20px;vertical-align:top;padding-top:2px;">
                      <div style="color:#16A34A;font-size:16px;line-height:1;">✓</div>
                    </td>
                    <td style="padding-left:10px;font-size:13px;color:#166534;line-height:1.6;">${text}</td>
                  </tr>
                </table>`).join('')}
              </td></tr>
            </table>

            <p style="margin:0 0 24px;font-size:15px;color:#3D3A5C;line-height:1.65;">
              Once again, congratulations on this achievement. We look forward to connecting with you soon.
            </p>

            <p style="margin:0;font-size:14px;color:#6E6B90;line-height:1.6;">
              Warm regards,<br>
              <strong style="color:#0D0D1A;">The Cuemath Hiring Team</strong>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F8F7FE;padding:20px 36px;border-top:1px solid #E2E0F0;">
            <p style="margin:0;font-size:12px;color:#A09DBC;text-align:center;">
              © ${new Date().getFullYear()} Cuemath &nbsp;·&nbsp; This message was sent to ${to}
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
    : `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F0EFFA;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0EFFA;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(13,13,26,0.10);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#5B4CF5 0%,#8B5CF6 100%);padding:32px 36px;">
            <div style="display:inline-block;background:rgba(255,255,255,0.18);padding:6px 14px;border-radius:8px;font-size:13px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">CUEMATH</div>
            <h1 style="margin:20px 0 4px;font-size:26px;font-weight:800;color:#ffffff;line-height:1.25;">Thank you, ${firstName}</h1>
            <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.82);line-height:1.5;">An update on your Cuemath tutor application.</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 36px;">
            <p style="margin:0 0 16px;font-size:15px;color:#3D3A5C;line-height:1.65;">
              Hi ${firstName}, thank you for taking the time to complete the AI screening interview with Cuemath. We genuinely appreciate your enthusiasm and the effort you put into the process.
            </p>
            <p style="margin:0 0 16px;font-size:15px;color:#3D3A5C;line-height:1.65;">
              After a thorough review of your screening, we have decided not to move forward with your application at this stage. This was not an easy decision — we received many strong applications, and competition for open positions is high.
            </p>

            <!-- Feedback note -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0EFFA;border:1px solid #E2E0F0;border-radius:14px;margin:24px 0;">
              <tr><td style="padding:20px 24px;">
                <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#6E6B90;text-transform:uppercase;letter-spacing:1px;">A note from the team</p>
                <p style="margin:0;font-size:13px;color:#3D3A5C;line-height:1.65;">
                  We encourage you to continue developing your teaching skills and to apply again in the future. Cuemath regularly opens new positions, and we'd be glad to review your application again.
                </p>
              </td></tr>
            </table>

            <p style="margin:0 0 24px;font-size:15px;color:#3D3A5C;line-height:1.65;">
              We wish you every success in your future endeavours, and we hope our paths cross again.
            </p>

            <p style="margin:0;font-size:14px;color:#6E6B90;line-height:1.6;">
              With appreciation,<br>
              <strong style="color:#0D0D1A;">The Cuemath Hiring Team</strong>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F8F7FE;padding:20px 36px;border-top:1px solid #E2E0F0;">
            <p style="margin:0;font-size:12px;color:#A09DBC;text-align:center;">
              © ${new Date().getFullYear()} Cuemath &nbsp;·&nbsp; This message was sent to ${to}
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  try {
    const transporter = getTransporter()
    await transporter.sendMail({
      from: `"Cuemath Hiring" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html: bodyHtml,
    })
    return true
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    // Admin only
    const authClient = await getAuthClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, decision } = body

    if (!sessionId || (decision !== 'accept' && decision !== 'reject')) {
      return NextResponse.json({ error: 'Missing sessionId or invalid decision.' }, { status: 400 })
    }

    const supabase = getServiceClient()

    const { data: session } = await supabase
      .from('sessions')
      .select('id, candidate_name, candidate_email, status')
      .eq('id', sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    // Update session status
    await supabase
      .from('sessions')
      .update({ status: decision === 'accept' ? 'accepted' : 'rejected' })
      .eq('id', sessionId)

    // Send email if candidate has an email address
    let emailSent = false
    if (session.candidate_email) {
      emailSent = await sendDecisionEmail(session.candidate_email, session.candidate_name, decision)
    }

    return NextResponse.json({ success: true, emailSent })
  } catch (err) {
    console.error('Decision error:', err)
    return NextResponse.json({ error: 'Could not send decision.' }, { status: 500 })
  }
}
