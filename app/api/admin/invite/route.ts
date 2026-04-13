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

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: 'Cuemath Hiring <onboarding@resend.dev>',
      to,
      subject: 'Your Cuemath AI Interview Invitation',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #111;">
          <div style="margin-bottom: 24px;">
            <span style="background: #4338ca; color: white; font-weight: 700; font-size: 14px; padding: 6px 12px; border-radius: 8px;">Cuemath</span>
          </div>
          <h2 style="font-size: 22px; font-weight: 600; margin-bottom: 8px;">Hi ${candidateName},</h2>
          <p style="color: #555; margin-bottom: 24px;">You've been invited to complete an AI-powered teaching screener for Cuemath. It takes about 10 minutes.</p>
          <p style="color: #333; margin-bottom: 8px; font-weight: 500;">Your access code:</p>
          <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #4338ca;">${code}</span>
          </div>
          <p style="color: #555; margin-bottom: 24px;">Visit the link below, enter your email and this code to begin:</p>
          <a href="${appUrl}" style="display: inline-block; background: #4338ca; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600;">Start Interview →</a>
          <p style="color: #999; font-size: 12px; margin-top: 32px;">This code expires in 48 hours. If you didn't expect this email, please ignore it.</p>
        </div>
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
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

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
