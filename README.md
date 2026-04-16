# Cuemath AI Tutor Screener

An AI-powered voice interviewer that conducts 10-minute screening calls with tutor candidates, evaluates their soft skills, and gives hiring managers a structured recommendation — without a human on the call.

**Live demo:** https://the-ai-tutor-screener-ej36.vercel.app

---

## Quick start — how to test end to end

### 1. Install and run
```bash
npm install
cp .env.example .env.local   # fill in keys (see bottom of this file)
npm run dev                  # starts at http://localhost:3000
```

### 2. Create an admin account
Go to your Supabase project → Authentication → Users → **Add user**  
Use any email + password. That account is your admin login.

### 3. Sign in as admin
```
http://localhost:3000/admin/login
```
Email + password from step 2.

### 4. Invite a candidate
On the admin dashboard click **+ Invite Candidate**, enter a name and email.  
Copy the **6-digit access code** shown (or check the email if Resend is configured).

### 5. Take the interview as a candidate
Open a new tab (or incognito window):
```
http://localhost:3000
```
Enter the email and code from step 4, confirm your name, and complete the ~10-minute voice interview.  
Allow microphone access when the browser asks.

### 6. Evaluate and review
Back in the admin tab, refresh the dashboard.  
The session will show status **Evaluated** — click **View report →** to see scores, radar chart, transcript, and recordings.

### 7. Send decision
On the report page scroll to **Hiring Decision** and click **Accept** or **Reject** to send the candidate an email.

### Page routes at a glance
| Path | Who uses it |
|------|-------------|
| `/` | Candidate — enter invite code |
| `/interview/[sessionId]` | Candidate — live voice interview |
| `/report/[sessionId]` | Candidate — thank-you / next steps |
| `/admin/login` | Admin — sign in |
| `/admin` | Admin — pipeline dashboard |
| `/admin/report/[sessionId]` | Admin — full evaluation report |

---

## What it does

1. **Admin invites a candidate** — enters their name + email, system sends a 6-digit access code
2. **Candidate opens the link** — enters email + code, confirms their name
3. **AI conducts the interview** — voice-only, ~10 minutes, 5–6 questions across all soft-skill dimensions
4. **AI evaluates the transcript** — GPT-4o scores 5 dimensions with verbatim quotes as evidence
5. **Admin reviews the report** — scores, justifications, flags, full transcript, per-turn audio
6. **Admin sends decision** — one click to send accept or reject email to the candidate

---

## Architecture

```
Candidate browser
  → Web Speech API (real-time display)
  → MediaRecorder → Whisper API (final transcription per turn)
  → ElevenLabs TTS (AI voice)

Backend (Next.js App Router API routes)
  → GPT-4o (conversation + evaluation)
  → Supabase (sessions, messages, evaluations DB)
  → Supabase Storage (per-turn audio recordings)
  → Resend (invite + decision emails)

Admin (protected by Supabase Auth)
  → Dashboard, full report, audio playback, accept/reject
```

---

## Key decisions and tradeoffs

**Web Speech API + Whisper, not Whisper alone**
Whisper is accurate but has ~2s latency per chunk. Using Web Speech API for real-time transcript display gives the candidate instant visual feedback that they're being heard, while Whisper runs in the background for the authoritative final transcript. Without this, the interview feels broken.

**GPT-4o for both conversation and evaluation**
A single model handles two jobs. The conversation prompt is carefully tuned to be warm and natural (no "Amazing!", no fake enthusiasm). The evaluation prompt uses a detailed rubric with anchor examples at each score level — this produces consistent, justifiable scores rather than vibes-based pass/fail.

**Per-turn audio files, not one big recording**
Recording the whole session as one file would require OS-level audio capture (not browser-feasible). Instead, each candidate turn is captured separately via MediaRecorder and uploaded to Supabase Storage. The admin panel can play each turn inline or download a merged full-interview WAV (AI questions re-synthesized + candidate answers concatenated via Web Audio API).

**Invite-code flow, not open signup**
Candidates can only interview if admin sends them a code. This prevents random people from consuming API credits and keeps the pipeline clean. Codes expire after 48 hours.

**Completion percentage scaling**
If a candidate leaves mid-interview, their composite score is multiplied by completion% (max of questions-answered% and time-elapsed%). System-triggered endings (time limit, 3 consecutive skips, natural completion) always get 100% weighting. This prevents gaming the system by leaving early.

---

## Evaluation rubric

| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| Communication Clarity | 25% | Structured explanations, no jargon, checks understanding |
| Teaching Ability | 25% | Analogies, simplification, student-perspective thinking |
| Patience | 20% | Multiple approaches, emotional regulation, validates struggle |
| Warmth | 20% | Genuine care, emotional attunement, confidence rebuilding |
| English Fluency | 10% | Grammar, sentence structure, comprehensibility |

Recommendations: `strong_hire` (≥4.0), `consider` (≥3.0), `do_not_advance` (<3.0)

---

## Edge cases handled

| Situation | Handling |
|-----------|----------|
| One-word / "I don't know" answer | Gentle encouragement → re-ask in simpler form → move on |
| Vague answer (10–30 words) | One follow-up probe to draw out a concrete example |
| Long tangent (>2 min turn) | Graceful cutoff, AI redirects to specific question |
| 3 consecutive skips | System ends interview, full score weight applied |
| Interview time limit hit | Auto-end with full score weight |
| Choppy audio / low confidence | Whisper log-probability confidence score stored, flagged `[low confidence]` in transcript |
| AudioContext suspended (mobile) | Detected and resumed before recording starts |
| Candidate closes tab early | localStorage session persists; completion% calculated on evaluate |

---

## What I'd improve with more time

- **Real-time adaptive difficulty** — currently GPT adapts based on conversation history in the prompt, but explicit scoring mid-interview could drive smarter question selection
- **Multi-language support** — force `language: 'en'` in Whisper works for English screening but could be made configurable
- **Batch evaluation** — currently evaluates one session at a time; a queue worker would be better at scale
- **Video recording option** — browser MediaRecorder supports video; would give evaluators richer context
- **Structured follow-up questions** — current follow-ups are GPT-generated; a bank of dimension-specific probes would be more consistent

---

## Setup

```bash
npm install
cp .env.example .env.local  # fill in your keys
npm run dev
```

Required environment variables:
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
ELEVENLABS_API_KEY=          # optional — falls back to browser TTS
ELEVENLABS_VOICE_ID=         # optional
RESEND_API_KEY=              # optional — invite/decision emails
NEXT_PUBLIC_APP_URL=         # your deployed URL
```

Supabase setup: run the migration in `/supabase/` to create the `sessions`, `messages`, and `evaluations` tables, and create a private `recordings` storage bucket.
