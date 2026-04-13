import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getServiceClient, getAuthClient } from '@/lib/supabase'

async function sendDecisionEmail(
  to: string,
  candidateName: string,
  decision: 'accept' | 'reject'
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false

  const firstName = candidateName.split(' ')[0]

  const subject = decision === 'accept'
    ? 'Congratulations — Next Steps with Cuemath'
    : 'Update on Your Cuemath Application'

  const bodyHtml = decision === 'accept'
    ? `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #111;">
        <div style="margin-bottom: 24px;">
          <span style="background: #4338ca; color: white; font-weight: 700; font-size: 14px; padding: 6px 12px; border-radius: 8px;">Cuemath</span>
        </div>
        <h2 style="font-size: 22px; font-weight: 600; margin-bottom: 8px;">Hi ${firstName},</h2>
        <p style="color: #555; margin-bottom: 16px;">
          We're excited to let you know that you've been shortlisted after your AI screening interview with Cuemath!
        </p>
        <p style="color: #555; margin-bottom: 16px;">
          Our team was impressed with your responses and would love to move forward with you. Someone from the Cuemath team will be in touch shortly with the next steps.
        </p>
        <p style="color: #555; margin-bottom: 24px;">Congratulations, and welcome aboard!</p>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">Cuemath Hiring Team</p>
      </div>
    `
    : `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #111;">
        <div style="margin-bottom: 24px;">
          <span style="background: #4338ca; color: white; font-weight: 700; font-size: 14px; padding: 6px 12px; border-radius: 8px;">Cuemath</span>
        </div>
        <h2 style="font-size: 22px; font-weight: 600; margin-bottom: 8px;">Hi ${firstName},</h2>
        <p style="color: #555; margin-bottom: 16px;">
          Thank you for taking the time to complete the AI screening interview with Cuemath.
        </p>
        <p style="color: #555; margin-bottom: 16px;">
          After careful review, we've decided not to move forward with your application at this time. We appreciate your interest in joining Cuemath and encourage you to apply again in the future.
        </p>
        <p style="color: #555; margin-bottom: 24px;">We wish you all the best in your endeavors.</p>
        <p style="color: #999; font-size: 12px; margin-top: 32px;">Cuemath Hiring Team</p>
      </div>
    `

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: 'Cuemath Hiring <onboarding@resend.dev>',
      to,
      subject,
      html: bodyHtml,
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
