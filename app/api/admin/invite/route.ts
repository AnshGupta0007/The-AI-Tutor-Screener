import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getServiceClient, getAuthClient } from '@/lib/supabase'

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function sendInviteEmail(
  to: string,
  candidateName: string,
  code: string,
  appUrl: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false

  const firstName = candidateName.split(' ')[0]

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: 'Cuemath Hiring <onboarding@resend.dev>',
      to,
      subject: 'Congratulations! You\'ve been selected for the Cuemath AI Screening Round',
      html: `
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
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="display:inline-block;background:rgba(255,255,255,0.18);padding:6px 14px;border-radius:8px;font-size:13px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">CUEMATH</div>
                  <div style="margin-top:20px;">
                    <div style="display:inline-block;background:rgba(255,255,255,0.20);border-radius:50px;padding:5px 14px;font-size:12px;font-weight:600;color:rgba(255,255,255,0.90);letter-spacing:0.8px;text-transform:uppercase;">Screening Round</div>
                  </div>
                  <h1 style="margin:12px 0 4px;font-size:26px;font-weight:800;color:#ffffff;line-height:1.25;">Congratulations, ${firstName}! 🎉</h1>
                  <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.82);line-height:1.5;">You've been selected to advance to our AI Screening Round.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 36px;">
            <p style="margin:0 0 16px;font-size:15px;color:#3D3A5C;line-height:1.65;">
              Hi ${firstName}, great news — after reviewing your profile, the Cuemath hiring team has selected you to move forward in our recruitment process.
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#3D3A5C;line-height:1.65;">
              The next step is a <strong style="color:#0D0D1A;">~10-minute AI-powered voice screening</strong> that evaluates your teaching style, communication, and candidate empathy. No prep needed — just be yourself.
            </p>

            <!-- Code block -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0EFFA;border-radius:14px;margin-bottom:24px;">
              <tr>
                <td style="padding:22px;text-align:center;">
                  <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#6E6B90;text-transform:uppercase;letter-spacing:1px;">Your Access Code</p>
                  <div style="font-size:40px;font-weight:800;letter-spacing:10px;color:#5B4CF5;line-height:1;">${code}</div>
                  <p style="margin:10px 0 0;font-size:12px;color:#A09DBC;">Valid for <strong>3 days</strong> from the time this email was sent</p>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td align="center">
                  <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#5B4CF5 0%,#8B5CF6 100%);color:#ffffff;font-size:15px;font-weight:700;padding:14px 32px;border-radius:12px;text-decoration:none;letter-spacing:0.3px;">Begin Your Screening →</a>
                </td>
              </tr>
            </table>

            <!-- Steps -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E2E0F0;border-radius:14px;margin-bottom:24px;">
              <tr><td style="padding:20px 24px;">
                <p style="margin:0 0 14px;font-size:12px;font-weight:700;color:#6E6B90;text-transform:uppercase;letter-spacing:1px;">What to expect</p>
                ${[
                  ['1', 'Visit the link above and enter your email + code'],
                  ['2', 'Allow microphone access — the interview is voice-only'],
                  ['3', 'Answer 5–6 questions about teaching &amp; working with students'],
                  ['4', 'Submit and await your result by email within 2–3 business days'],
                ].map(([n, text]) => `
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
                  <tr>
                    <td style="width:28px;vertical-align:top;">
                      <div style="width:22px;height:22px;background:#EEEBFF;border-radius:6px;text-align:center;line-height:22px;font-size:11px;font-weight:800;color:#5B4CF5;">${n}</div>
                    </td>
                    <td style="padding-left:10px;font-size:13px;color:#3D3A5C;line-height:1.5;">${text}</td>
                  </tr>
                </table>`).join('')}
              </td></tr>
            </table>

            <p style="margin:0;font-size:13px;color:#A09DBC;line-height:1.6;">
              ⏰ This code expires in <strong>3 days</strong>. Please complete the screening before then.<br>
              If you have any issues, reply to this email.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F8F7FE;padding:20px 36px;border-top:1px solid #E2E0F0;">
            <p style="margin:0;font-size:12px;color:#A09DBC;text-align:center;">
              © ${new Date().getFullYear()} Cuemath &nbsp;·&nbsp; This invite was sent to ${to}
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
      `,
    })
    return !error
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
    const { candidateName, candidateEmail } = body

    if (!candidateName || typeof candidateName !== 'string' || candidateName.trim().length < 2) {
      return NextResponse.json({ error: 'Candidate name is required.' }, { status: 400 })
    }
    if (!candidateEmail || typeof candidateEmail !== 'string' || !candidateEmail.includes('@')) {
      return NextResponse.json({ error: 'Valid candidate email is required.' }, { status: 400 })
    }

    const supabase = getServiceClient()
    const code = generateCode()
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() // 3 days

    // Create session with invited status
    const { data: session, error } = await supabase
      .from('sessions')
      .insert({
        candidate_name: candidateName.trim(),
        candidate_email: candidateEmail.trim().toLowerCase(),
        status: 'pending',
        invite_code: code,
        invite_expires_at: expiresAt,
      })
      .select()
      .single()

    if (error || !session) {
      console.error('Invite creation error:', error)
      return NextResponse.json({ error: 'Could not create invite.' }, { status: 500 })
    }

    // Try to send email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const emailSent = await sendInviteEmail(
      candidateEmail.trim().toLowerCase(),
      candidateName.trim(),
      code,
      appUrl
    )

    return NextResponse.json({
      sessionId: session.id,
      code,
      emailSent,
    })
  } catch (err) {
    console.error('Invite error:', err)
    return NextResponse.json({ error: 'Could not create invite.' }, { status: 500 })
  }
}
