'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import TranscriptPanel from './components/TranscriptPanel'
import ControlBar from './components/ControlBar'
import MicDeniedScreen from './components/MicDeniedScreen'
import MicCheckScreen from './components/MicCheckScreen'
import type { ConversationMessage, InterviewPhase, RubricDimension } from '@/lib/types'
import { QUESTION_BANK } from '@/lib/questions'

interface SessionState {
  sessionId: string
  candidateName: string
  greetingText: string
  warmUpQuestionId: string
  coreQuestionIds: string[]
  phase: InterviewPhase
  questionsAsked: string[]
  turnNumber: number
  conversationHistory: ConversationMessage[]
  consecutiveSkips: number
  savedAt: string
}

function detectBrowser(): string {
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad/.test(ua)) return 'ios'
  if (/chrome/.test(ua) && !/edge/.test(ua)) return 'chrome'
  if (/firefox/.test(ua)) return 'firefox'
  if (/safari/.test(ua)) return 'safari'
  if (/edg/.test(ua)) return 'edge'
  return 'other'
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length
}

function hasHedging(text: string): boolean {
  return /\bi guess\b|\bmaybe\b|\bit depends\b|\bi suppose\b|\bprobably\b|\bnot sure\b/i.test(text)
}

function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    '',
  ]
  for (const type of types) {
    if (type === '' || MediaRecorder.isTypeSupported(type)) return type
  }
  return ''
}

const SILENCE_DOTS_MS = 4000
const SILENCE_SOFT_MS = 8000
const SILENCE_REASK_MS = 18000
const SILENCE_SKIP_MS = 30000
const RAMBLE_MS = 90000

// Smart pause: after candidate has spoken, a 6-second pause triggers a countdown modal
const SMART_PAUSE_TRIGGER_MS = 6000 // silence after speech → show modal
const SMART_PAUSE_COUNTDOWN_SECS = 10 // seconds before auto-proceeding
const MAX_TURN_SECS = 120 // 2 minutes — can't keep extending past this

export default function InterviewPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string

  const [sessionState, setSessionState] = useState<SessionState | null>(null)
  const [loading, setLoading] = useState(true)
  const [micDenied, setMicDenied] = useState(false)
  const [showMicCheck, setShowMicCheck] = useState(false)
  const [micStream, setMicStream] = useState<MediaStream | null>(null)
  const [browser, setBrowser] = useState('other')
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [showEndEarlyModal, setShowEndEarlyModal] = useState(false)
  const [showResumeModal, setShowResumeModal] = useState(false)
  const [resumeState, setResumeState] = useState<SessionState | null>(null)
  const [showPauseModal, setShowPauseModal] = useState(false)
  const [pauseCountdown, setPauseCountdown] = useState(SMART_PAUSE_COUNTDOWN_SECS)

  // Interview UI state
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [currentPartialTranscript, setCurrentPartialTranscript] = useState('')
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [isMicActive, setIsMicActive] = useState(false)
  const [showSilenceDots, setShowSilenceDots] = useState(false)
  const [canRepeat, setCanRepeat] = useState(false)
  const [repeatUsed, setRepeatUsed] = useState(0)
  const [phase, setPhase] = useState<InterviewPhase>('greeting')
  const [questionsAsked, setQuestionsAsked] = useState<string[]>([])
  const [consecutiveSkips, setConsecutiveSkips] = useState(0)
  const [isCompleting, setIsCompleting] = useState(false) // shows "please don't close" overlay

  // Refs — audio/recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null) // SpeechRecognition instance
  const recordingMimeTypeRef = useRef<string>('audio/webm') // actual mimeType used by MediaRecorder

  // Refs — timers (ALL timers must be in refs so clearAllTimers works fully)
  const dotsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const softPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reaskTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rambleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const repeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pauseModalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Refs — interview state
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const lastQuestionTextRef = useRef('')
  const lastQuestionAudioRef = useRef('')
  const turnTranscriptRef = useRef('')
  const audioChunksRef = useRef<Blob[]>([])
  const hasSpokenRef = useRef(false) // true once amplitude > threshold detected this turn
  const followUpAskedRef = useRef(false)
  const turnNumberRef = useRef(0)
  const coreTurnsRef = useRef(0) // counts completed core turns to know when all questions are done
  const interviewStartTimeRef = useRef<number | null>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null) // seconds remaining
  const lowConfidenceAskedRef = useRef(false) // track per-turn low-conf re-ask
  const softPromptGivenRef = useRef(false) // prevent duplicate "take your time" per turn
  const lastDisplayedTranscriptRef = useRef('') // last text shown on screen — fallback if SpeechRecognition finals are lost
  const isFinishingRef = useRef(false) // guard against double finishInterview calls
  const isProcessingTurnRef = useRef(false) // guard against double handleDoneAnswering calls
  const turnStartTimeRef = useRef<number>(0) // when current candidate turn started
  const showPauseModalRef = useRef(false) // readable in rAF loop without stale closure

  // ─── Initialisation ───────────────────────────────────────────────────────

  useEffect(() => {
    setBrowser(detectBrowser())

    const stored = localStorage.getItem('cuemath_session')
    if (!stored) { router.push('/'); return }

    let state: SessionState
    try { state = JSON.parse(stored) } catch { router.push('/'); return }

    if (state.sessionId !== sessionId) { router.push('/'); return }

    const hoursAgo = (Date.now() - new Date(state.savedAt).getTime()) / 3_600_000
    if (hoursAgo > 24) {
      localStorage.removeItem('cuemath_session')
      router.push('/')
      return
    }

    // If session was already in progress (not fresh greeting), show resume modal
    if (
      state.phase !== 'greeting' &&
      state.conversationHistory &&
      state.conversationHistory.length > 0
    ) {
      setResumeState(state)
      setShowResumeModal(true)
      setLoading(false)
      return
    }

    applyState(state)
    setLoading(false)
  }, [sessionId, router])

  function applyState(state: SessionState) {
    setSessionState(state)
    setMessages(state.conversationHistory || [])
    setPhase(state.phase || 'greeting')
    setQuestionsAsked(state.questionsAsked || [])
    setConsecutiveSkips(state.consecutiveSkips || 0)
    turnNumberRef.current = state.turnNumber || 0
  }

  // Auto-save every 30s
  useEffect(() => {
    if (!sessionState) return
    saveTimerRef.current = setInterval(() => {
      const updated: SessionState = {
        ...sessionState,
        phase,
        questionsAsked,
        turnNumber: turnNumberRef.current,
        conversationHistory: messages,
        consecutiveSkips,
        savedAt: new Date().toISOString(),
      }
      localStorage.setItem('cuemath_session', JSON.stringify(updated))
    }, 30_000)
    return () => { if (saveTimerRef.current) clearInterval(saveTimerRef.current) }
  }, [sessionState, phase, questionsAsked, messages, consecutiveSkips])

  // 10-minute countdown timer
  const MAX_DURATION_SECS = 10 * 60
  useEffect(() => {
    if (timeLeft === null) return
    if (timeLeft <= 0) {
      endInterviewEarly(true) // system-forced: time limit reached → full score weightage
      return
    }
    const t = setTimeout(() => setTimeLeft(s => (s ?? 1) - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft])

  // Smart pause countdown — ticks down while modal is visible, auto-proceeds at 0
  useEffect(() => {
    if (!showPauseModal) return
    if (pauseCountdown <= 0) {
      handlePauseModalProceed()
      return
    }
    const t = setTimeout(() => setPauseCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPauseModal, pauseCountdown])

  // Mark session abandoned on tab close
  useEffect(() => {
    function handleBeforeUnload() {
      navigator.sendBeacon(
        '/api/session/abandon',
        JSON.stringify({ sessionId })
      )
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [sessionId])

  // Init mic once session state is applied and not showing resume modal
  useEffect(() => {
    if (!sessionState || loading || showResumeModal) return
    initMicAndStart()
    return () => {
      stopMic()
      speechSynthesis.cancel()
      if (currentAudioRef.current) currentAudioRef.current.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, showResumeModal])

  // ─── Mic & Audio ──────────────────────────────────────────────────────────

  async function initMicAndStart() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream
      setMicStream(stream)
      setShowMicCheck(true) // show mic check before playing greeting
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : ''
      if (name === 'NotAllowedError' || name === 'NotFoundError') {
        setMicDenied(true)
      }
    }
  }

  async function handleMicCheckReady() {
    setShowMicCheck(false)
    await playGreeting()
  }

  function stopMic(): Promise<void> {
    clearAllTimers()
    setIsMicActive(false)
    setShowSilenceDots(false)

    // Clear recognition ref first — prevents the onend handler from restarting it
    const recog = recognitionRef.current
    recognitionRef.current = null
    try { recog?.stop() } catch {}

    return new Promise(resolve => {
      const recorder = mediaRecorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = () => {
          if (streamRef.current) streamRef.current.getTracks().forEach(t => { t.enabled = false })
          resolve()
        }
        recorder.stop()
      } else {
        if (streamRef.current) streamRef.current.getTracks().forEach(t => { t.enabled = false })
        resolve()
      }
    })
  }

  function clearAllTimers() {
    if (dotsTimerRef.current)       clearTimeout(dotsTimerRef.current)
    if (softPromptTimerRef.current) clearTimeout(softPromptTimerRef.current)
    if (reaskTimerRef.current)      clearTimeout(reaskTimerRef.current)
    if (skipTimerRef.current)       clearTimeout(skipTimerRef.current)
    if (rambleTimerRef.current)     clearTimeout(rambleTimerRef.current)
    if (repeatTimerRef.current)     clearTimeout(repeatTimerRef.current)
    if (pauseModalTimerRef.current) clearTimeout(pauseModalTimerRef.current)
  }

  // ─── Speech Synthesis ─────────────────────────────────────────────────────

  async function speakText(text: string): Promise<void> {
    return new Promise(resolve => {
      speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.95
      utterance.pitch = 1.0
      utterance.volume = 1.0
      const voices = speechSynthesis.getVoices()
      const preferred =
        voices.find(v => v.lang === 'en-US' && !v.localService) ||
        voices.find(v => v.lang.startsWith('en-')) ||
        voices[0]
      if (preferred) utterance.voice = preferred
      utterance.onend = () => resolve()
      utterance.onerror = () => resolve()
      speechSynthesis.speak(utterance)
    })
  }

  async function playAudio(base64DataUrl: string): Promise<void> {
    return new Promise(resolve => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }
      const audio = new Audio(base64DataUrl)
      currentAudioRef.current = audio
      audio.onended = () => resolve()
      audio.onerror = () => resolve()
      audio.play().catch(() => resolve())
    })
  }

  async function speakAI(text: string, audioData?: string | null): Promise<void> {
    if (audioData) {
      await playAudio(audioData)
    } else {
      // Try fetching ElevenLabs TTS server-side
      try {
        const res = await fetch('/api/speech/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })
        const data = await res.json()
        if (data.audioData) {
          await playAudio(data.audioData)
          return
        }
      } catch { /* fall through */ }
      await speakText(text)
    }
  }

  // ─── Greeting ─────────────────────────────────────────────────────────────

  async function playGreeting() {
    if (!sessionState) return
    const text = sessionState.greetingText
    setIsAiSpeaking(true)
    addMessage('assistant', text)
    await speakAI(text)
    setIsAiSpeaking(false)
    interviewStartTimeRef.current = Date.now()
    setTimeLeft(MAX_DURATION_SECS)
    startCandidateTurn()
  }

  // ─── Candidate Turn ───────────────────────────────────────────────────────

  function startCandidateTurn() {
    if (!streamRef.current) return

    streamRef.current.getTracks().forEach(t => { t.enabled = true })

    // ── MediaRecorder: collect audio chunks for Whisper at turn-end ──
    const mimeType = getSupportedMimeType()
    const recorderOptions = mimeType ? { mimeType } : {}
    const recorder = new MediaRecorder(streamRef.current, recorderOptions)
    const actualMime = (recorder.mimeType || mimeType || 'audio/webm').split(';')[0].trim()
    recordingMimeTypeRef.current = actualMime
    mediaRecorderRef.current = recorder
    audioChunksRef.current = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data)
    }
    recorder.start() // no timeslice — single complete blob on stop(); timeslice produces invalid MP4 fragments

    // Reset turn state
    isProcessingTurnRef.current = false
    turnTranscriptRef.current = ''
    hasSpokenRef.current = false
    followUpAskedRef.current = false
    lowConfidenceAskedRef.current = false
    softPromptGivenRef.current = false
    lastDisplayedTranscriptRef.current = ''
    turnStartTimeRef.current = Date.now()
    setShowPauseModal(false)
    showPauseModalRef.current = false
    setPauseCountdown(SMART_PAUSE_COUNTDOWN_SECS)
    setCurrentPartialTranscript('')

    // ── SpeechRecognition: real-time display + speech/silence detection ──
    // Works independently of AudioContext state. Chrome/Safari only; Firefox falls back
    // to timer-based detection (smart-pause still fires after SILENCE_SKIP_MS).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI: any = typeof window !== 'undefined' &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'
      recognitionRef.current = recognition

      recognition.onresult = (event: any) => {
        let interim = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            turnTranscriptRef.current = (
              turnTranscriptRef.current + ' ' + event.results[i][0].transcript
            ).trim()
          } else {
            interim += event.results[i][0].transcript
          }
        }
        const display = (turnTranscriptRef.current + (interim ? ' ' + interim : '')).trim()
        setCurrentPartialTranscript(display || '...')
        // Store the last shown text (includes interim) so we can use it as fallback
        // if Chrome never promotes it to a final result before the turn ends
        if (display) lastDisplayedTranscriptRef.current = display
        hasSpokenRef.current = true
        resetSilenceTimers()
      }

      recognition.onend = () => {
        // Chrome auto-stops after silence — restart as long as turn is still active
        if (recognitionRef.current === recognition) {
          try { recognition.start() } catch {}
        }
      }

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn('[SpeechRecognition] error:', event.error)
        }
      }

      try { recognition.start() } catch (e) {
        console.warn('[SpeechRecognition] start failed:', e)
      }
    }

    setIsMicActive(true)
    startSilenceTimers()
    rambleTimerRef.current = setTimeout(() => handleRamble(), RAMBLE_MS)
  }

  function resetSilenceTimers() {
    if (dotsTimerRef.current)       clearTimeout(dotsTimerRef.current)
    if (softPromptTimerRef.current) clearTimeout(softPromptTimerRef.current)
    if (reaskTimerRef.current)      clearTimeout(reaskTimerRef.current)
    if (skipTimerRef.current)       clearTimeout(skipTimerRef.current)
    if (pauseModalTimerRef.current) clearTimeout(pauseModalTimerRef.current)
    setShowSilenceDots(false)
    // If pause modal was showing and candidate started speaking again — dismiss it
    if (showPauseModalRef.current) {
      setShowPauseModal(false)
      showPauseModalRef.current = false
      setPauseCountdown(SMART_PAUSE_COUNTDOWN_SECS)
    }
    startSilenceTimers()
  }

  function startSilenceTimers() {
    dotsTimerRef.current = setTimeout(() => {
      setShowSilenceDots(true)
    }, SILENCE_DOTS_MS)

    softPromptTimerRef.current = setTimeout(() => {
      // Only nudge once per turn, and only after the candidate has started speaking
      if (hasSpokenRef.current && !softPromptGivenRef.current) {
        softPromptGivenRef.current = true
        addSilentPromptToTranscript()
      }
    }, SILENCE_SOFT_MS)

    reaskTimerRef.current = setTimeout(async () => {
      if (showPauseModalRef.current) return // modal is handling it
      // Only re-ask if candidate actually started speaking — prevents endless re-ask cycles
      // when the candidate is just slow to begin.
      if (!hasSpokenRef.current) return
      stopMic()
      setIsAiSpeaking(true)
      const reaskText = "Take your time — and feel free to share whatever comes to mind first."
      addMessage('assistant', reaskText)
      await speakAI(reaskText)
      setIsAiSpeaking(false)
      startCandidateTurn()
    }, SILENCE_REASK_MS)

    skipTimerRef.current = setTimeout(async () => {
      if (showPauseModalRef.current) return // modal is handling it
      await handleSkip()
    }, SILENCE_SKIP_MS)

    // Smart pause: fires 6 seconds after last sound, but only shows if candidate has already spoken.
    // Uses amplitude-based detection (hasSpokenRef) — not transcript length — because
    // transcription only happens at turn-end now, so turnTranscriptRef is empty during a turn.
    pauseModalTimerRef.current = setTimeout(() => {
      if (hasSpokenRef.current && !showPauseModalRef.current) {
        showPauseModalRef.current = true
        setShowPauseModal(true)
        setPauseCountdown(SMART_PAUSE_COUNTDOWN_SECS)
        // Suspend re-ask and skip while modal handles the flow
        if (reaskTimerRef.current) clearTimeout(reaskTimerRef.current)
        if (skipTimerRef.current)  clearTimeout(skipTimerRef.current)
      }
    }, SMART_PAUSE_TRIGGER_MS)
  }

  function addSilentPromptToTranscript() {
    setMessages(prev => [
      ...prev,
      { role: 'assistant', content: "Take your time — there's no rush." },
    ])
  }

  // ─── Transcription ────────────────────────────────────────────────────────

  async function transcribeChunk(blob: Blob, isFinal: boolean) {
    try {
      const fd = new FormData()
      // Strip codec suffix so Whisper receives a clean MIME type: 'audio/webm;codecs=opus' → 'audio/webm'
      const rawMime = blob.type || recordingMimeTypeRef.current || 'audio/webm'
      const mimeType = rawMime.split(';')[0].trim()
      const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm'
      const cleanBlob = new Blob([blob], { type: mimeType })
      fd.append('audio', cleanBlob, `audio.${ext}`)
      fd.append('sessionId', sessionId)
      fd.append('turnNumber', String(turnNumberRef.current))
      fd.append('isFinal', String(isFinal))

      const res = await fetch('/api/speech/transcribe', { method: 'POST', body: fd })
      if (!res.ok) return

      const data = await res.json()

      // Non-English detection removed — we force language:'en' in Whisper so detectedLanguage
      // is unreliable and causes false positives for short English phrases like "yes, I'm ready".
      // SpeechRecognition already handles display; the AI can handle language issues in conversation.

      if (data.transcript) {
        // Replace (not append) — each blob covers full audio from turn start
        turnTranscriptRef.current = data.transcript.trim()
        setCurrentPartialTranscript(turnTranscriptRef.current)

        // Low-confidence handling
        if (data.confidence < 0.6 && !lowConfidenceAskedRef.current) {
          lowConfidenceAskedRef.current = true
          stopMic()
          setIsAiSpeaking(true)
          const repeatText = "Sorry, I didn't quite catch that — could you say that part again?"
          addMessage('assistant', repeatText)
          await speakAI(repeatText)
          setIsAiSpeaking(false)
          // Reset transcript for fresh answer
          turnTranscriptRef.current = ''
          setCurrentPartialTranscript('')
          startCandidateTurn()
          return
        }
      }
    } catch {
      // Non-fatal
    }
  }

  // ─── Smart Pause Modal ────────────────────────────────────────────────────

  function handlePauseModalProceed() {
    setShowPauseModal(false)
    showPauseModalRef.current = false
    setPauseCountdown(SMART_PAUSE_COUNTDOWN_SECS)
    clearAllTimers()
    handleDoneAnswering()
  }

  function handlePauseModalExtend() {
    const turnElapsed = (Date.now() - turnStartTimeRef.current) / 1000
    setShowPauseModal(false)
    showPauseModalRef.current = false
    setPauseCountdown(SMART_PAUSE_COUNTDOWN_SECS)

    if (turnElapsed >= MAX_TURN_SECS) {
      // Already at 2 minutes — proceed anyway
      clearAllTimers()
      handleDoneAnswering()
      return
    }

    // Reset silence timers to give fresh time
    resetSilenceTimers()
  }

  // ─── Turn Endings ─────────────────────────────────────────────────────────

  async function handleDoneAnswering() {
    if (isAiSpeaking || isProcessingTurnRef.current) return
    isProcessingTurnRef.current = true
    await stopMic()
    await transcribeFinalAudio()
    await processEndOfTurn(false)
    isProcessingTurnRef.current = false
  }

  async function transcribeFinalAudio() {
    // Build complete blob from all collected chunks — same pattern as debug-mic (confirmed working)
    const blob = audioChunksRef.current.length > 0
      ? new Blob(audioChunksRef.current, { type: recordingMimeTypeRef.current })
      : null
    if (blob && blob.size > 500) {
      await transcribeChunk(blob, true)
    }
    // Fallback chain: Whisper result > SpeechRecognition finals > last displayed interim text
    // Covers the case where SpeechRecognition only produced interim results (never promoted to
    // final before stopMic) and Whisper also failed or returned empty.
    if (!turnTranscriptRef.current && lastDisplayedTranscriptRef.current) {
      turnTranscriptRef.current = lastDisplayedTranscriptRef.current
    }
    setCurrentPartialTranscript('')
  }

  async function handleRamble() {
    if (!isMicActive) return
    await stopMic()
    await transcribeFinalAudio()
    const text = "That's really helpful — I want to make sure we have time for everything, so let me ask you about something specific."
    setIsAiSpeaking(true)
    addMessage('assistant', text)
    await speakAI(text)
    setIsAiSpeaking(false)
    await processEndOfTurn(true)
  }

  async function handleSkip() {
    await stopMic()
    await transcribeFinalAudio()
    const newSkips = consecutiveSkips + 1
    setConsecutiveSkips(newSkips)

    if (newSkips >= 3) {
      await endInterviewEarly(true) // system-forced: max skips reached → full score weightage
      return
    }

    const skipText = "No worries — let's move on."
    setIsAiSpeaking(true)
    addMessage('assistant', skipText)
    await speakAI(skipText)
    setIsAiSpeaking(false)
    await processEndOfTurn(false)
  }

  // ─── Turn Processing ──────────────────────────────────────────────────────

  async function processEndOfTurn(wasRamble: boolean) {
    const transcript = turnTranscriptRef.current.trim()
    const words = wordCount(transcript)

    // Use a local variable so phase transitions within this call are visible
    // (React setState is async and won't update the closure until next render)
    let currentPhase = phase

    const needsFollowUp =
      !followUpAskedRef.current &&
      !wasRamble &&
      transcript.length > 0 &&
      (words < 30 || hasHedging(transcript))

    if (transcript) {
      addMessage('user', transcript)
    }

    setCurrentPartialTranscript('')
    turnNumberRef.current += 1

    let nextAction = 'acknowledge_and_ask'
    if (needsFollowUp) {
      nextAction = 'follow_up'
      followUpAskedRef.current = true
    } else if (
      currentPhase === 'greeting' &&
      /yes|ready|sure|okay|go ahead|let'?s/i.test(transcript)
    ) {
      // Greeting accepted → start warm-up
      nextAction = 'ask_question'
      currentPhase = 'warm_up'
      setPhase('warm_up')
    } else if (currentPhase === 'warm_up') {
      // Warm-up answered → move to core questions
      currentPhase = 'core'
      setPhase('core')
    }

    const remainingQuestions = buildRemainingQuestions()
    if (Object.keys(remainingQuestions).length === 0 && currentPhase === 'core') {
      nextAction = 'close'
      currentPhase = 'closing'
      setPhase('closing')
    } else if (currentPhase === 'closing') {
      // Already in closing phase (user replied after farewell) — force finish
      nextAction = 'close'
    }

    await callAiRespond(transcript, nextAction, remainingQuestions, currentPhase)
  }

  function buildRemainingQuestions() {
    if (!sessionState) return {}
    // Use turn counter — once we've had as many turns as there are questions, nothing remains
    const asked = sessionState.coreQuestionIds.slice(0, coreTurnsRef.current)
    const remaining: Partial<Record<RubricDimension, string[]>> = {}
    const allDims: RubricDimension[] = ['teaching_ability', 'patience', 'communication', 'warmth', 'fluency']
    for (const dim of allDims) {
      const ids = sessionState.coreQuestionIds.filter(id => {
        const q = QUESTION_BANK.find(q => q.id === id)
        return q && q.dimension === dim && !asked.includes(id)
      })
      if (ids.length > 0) remaining[dim] = ids
    }
    return remaining
  }

  // ─── AI Respond ───────────────────────────────────────────────────────────

  async function callAiRespond(
    turnTranscript: string,
    nextAction: string,
    remainingQuestions: Partial<Record<RubricDimension, string[]>>,
    currentPhase: InterviewPhase
  ) {
    if (!sessionState) return
    if (isFinishingRef.current) return
    setIsAiSpeaking(true)

    try {
      const res = await fetch('/api/interview/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          turnTranscript,
          conversationHistory: messages,
          phase: currentPhase,
          questionsAsked,
          remainingQuestions,
          candidateName: sessionState.candidateName,
          nextAction,
        }),
      })

      if (!res.ok) throw new Error('API error')

      const data = await res.json()

      addMessage('assistant', data.responseText)

      // Track question progress by counting core turns (GPT paraphrases so text-matching is unreliable)
      if (currentPhase === 'core' && !data.nextAction?.includes('follow_up')) {
        coreTurnsRef.current += 1
        const nextAsked = sessionState.coreQuestionIds.slice(0, coreTurnsRef.current)
        setQuestionsAsked(nextAsked)
      }

      // Store for repeat
      lastQuestionTextRef.current = data.responseText
      lastQuestionAudioRef.current = data.audioData || ''
      setRepeatUsed(0)
      setCanRepeat(true)

      const farewellRegex = /thank you for your time|all the best|good luck|take care|have a great day|wish you (all the best|well)|best of luck|in touch (soon|in \d)|pleasure (speaking|talking)|on behalf of cuemath/i
      const isClosing =
        nextAction === 'close' ||
        data.nextAction === 'close' ||
        data.phase === 'closing' ||
        currentPhase === 'closing' ||
        farewellRegex.test(data.responseText || '')

      await speakAI(data.responseText, data.audioData)

      setIsAiSpeaking(false)

      if (isFinishingRef.current) return  // timer or early-exit fired during AI speech

      if (isClosing) {
        await finishInterview()
        return
      }

      // Reset repeat timer
      if (repeatTimerRef.current) clearTimeout(repeatTimerRef.current)
      repeatTimerRef.current = setTimeout(() => setCanRepeat(false), 60_000)

      // Reset consecutive skips on successful answer
      setConsecutiveSkips(0)
      startCandidateTurn()
    } catch {
      setIsAiSpeaking(false)
      if (isFinishingRef.current) return
      addMessage('assistant', "I'm having a moment — give me a second.")
      await speakText("I'm having a moment — give me a second.")
      await new Promise(r => setTimeout(r, 2000))
      startCandidateTurn()
    }
  }

  // ─── Repeat Question ──────────────────────────────────────────────────────

  async function handleRepeatQuestion() {
    if (repeatUsed >= 2 || !lastQuestionTextRef.current) return
    setRepeatUsed(prev => prev + 1)
    stopMic()
    setIsAiSpeaking(true)
    await speakAI(lastQuestionTextRef.current, lastQuestionAudioRef.current || null)
    setIsAiSpeaking(false)
    startCandidateTurn()
  }

  // ─── Finish ───────────────────────────────────────────────────────────────

  function getCompletionPct(): number {
    // max(questions answered %, time elapsed %) — gives fairest credit for partial interviews
    const total = sessionState?.coreQuestionIds.length ?? 0
    const questionsPct = total > 0 ? Math.round((questionsAsked.length / total) * 100) : 0
    const durationPct = interviewStartTimeRef.current
      ? Math.min(100, Math.round(((Date.now() - interviewStartTimeRef.current) / (MAX_DURATION_SECS * 1000)) * 100))
      : 0
    return Math.max(questionsPct, durationPct)
  }

  async function finishInterview(completionPct?: number) {
    if (isFinishingRef.current) return
    isFinishingRef.current = true

    clearAllTimers()
    await stopMic()
    setPhase('ended')
    setCanRepeat(false)

    // Show "please don't close" overlay for 4 seconds while evaluation fires in background
    setIsCompleting(true)
    fetch('/api/interview/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, completionPct: completionPct ?? 100 }),
    }).catch(() => {})

    await new Promise(r => setTimeout(r, 4000))
    localStorage.removeItem('cuemath_session')
    router.push(`/report/${sessionId}`)
  }

  // systemForced = true  → time limit / max skips / natural close → pct = 100 (no penalty)
  // systemForced = false → candidate clicked "End Interview" early → pct = max(time%, questions%)
  async function endInterviewEarly(systemForced = false) {
    if (isFinishingRef.current) return
    isFinishingRef.current = true

    setShowEndEarlyModal(false)
    const pct = systemForced ? 100 : getCompletionPct()
    clearAllTimers()
    await stopMic()
    const text = "Thank you for your time. We have what we need — the Cuemath team will be in touch in 2–3 business days."
    setIsAiSpeaking(true)
    addMessage('assistant', text)
    await speakAI(text)
    setIsAiSpeaking(false)

    setIsCompleting(true)
    fetch('/api/interview/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, completionPct: pct }),
    }).catch(() => {})

    await new Promise(r => setTimeout(r, 4000))
    localStorage.removeItem('cuemath_session')
    router.push(`/report/${sessionId}`)
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function addMessage(role: ConversationMessage['role'], content: string, confidence?: number) {
    setMessages(prev => [...prev, { role, content, confidence }])
  }

  function handleRetryMic() {
    setMicDenied(false)
    setLoading(true)
    setTimeout(() => setLoading(false), 100)
  }

  function handleLeaveConfirm() {
    stopMic()
    speechSynthesis.cancel()
    localStorage.removeItem('cuemath_session')
    router.push('/')
  }

  function handleResumeYes() {
    if (!resumeState) return
    setShowResumeModal(false)
    applyState(resumeState)
  }

  function handleResumeNo() {
    localStorage.removeItem('cuemath_session')
    router.push('/')
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (isCompleting) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-center max-w-xs">
          <svg className="animate-spin h-8 w-8 mx-auto mb-4" style={{ color: 'var(--accent)' }} viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-base font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
            Saving your interview...
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Please don&apos;t close this tab — this only takes a few seconds.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 mx-auto mb-3" style={{ color: 'var(--accent)' }} viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Setting up your interview...</p>
        </div>
      </div>
    )
  }

  if (micDenied) {
    return <MicDeniedScreen onRetry={handleRetryMic} browser={browser} />
  }

  if (showMicCheck && micStream && sessionState) {
    return (
      <MicCheckScreen
        stream={micStream}
        candidateName={sessionState.candidateName}
        onReady={handleMicCheckReady}
      />
    )
  }

  // Resume modal
  if (showResumeModal && resumeState) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div
          className="w-full max-w-sm rounded-2xl p-7"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--bg-ai-message)' }}>
            <svg className="w-6 h-6" style={{ color: 'var(--accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-center mb-2" style={{ color: 'var(--text-primary)' }}>
            Resume your interview?
          </h2>
          <p className="text-sm text-center mb-6" style={{ color: 'var(--text-muted)' }}>
            We found a previous session for{' '}
            <strong>{resumeState.candidateName}</strong>. Would you like to continue where you left off?
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleResumeYes}
              className="flex-1 h-11 rounded-xl font-medium text-white text-sm"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              Continue
            </button>
            <button
              onClick={handleResumeNo}
              className="flex-1 h-11 rounded-xl font-medium text-sm border"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}
            >
              Start over
            </button>
          </div>
        </div>
      </div>
    )
  }

  const firstName = (sessionState?.candidateName || '').split(' ')[0]

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 md:px-6 py-3 border-b flex-shrink-0"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-xs)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
            style={{ background: 'var(--gradient-brand)' }}
          >
            C
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Cuemath AI Screener
          </span>
        </div>
        <div className="flex items-center gap-3">
          {firstName && (
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Hi, {firstName}</span>
          )}
          {phase === 'core' && sessionState && sessionState.coreQuestionIds.length > 0 && (
            <span
              className="text-xs font-medium px-2.5 py-1 rounded-lg"
              style={{ backgroundColor: 'var(--bg-ai-message)', color: 'var(--accent)' }}
            >
              Question {questionsAsked.length + 1}
            </span>
          )}
          {timeLeft !== null && phase !== 'ended' && (
            <span
              className="text-xs font-mono font-semibold px-2 py-1 rounded-lg"
              style={{
                backgroundColor: timeLeft <= 60 ? '#FEF2F2' : timeLeft <= 120 ? '#FEF9C3' : 'var(--bg-primary)',
                color: timeLeft <= 60 ? 'var(--danger)' : timeLeft <= 120 ? '#854D0E' : 'var(--text-muted)',
              }}
            >
              {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {phase !== 'greeting' && phase !== 'ended' && (
            <button
              onClick={() => setShowEndEarlyModal(true)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{ color: 'var(--danger)', border: '1px solid var(--danger)', backgroundColor: '#FEF2F2' }}
            >
              End Interview
            </button>
          )}
          <button
            onClick={() => setShowLeaveModal(true)}
            className="text-sm px-3 py-1.5 rounded-lg"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
          >
            Leave
          </button>
        </div>
      </header>

      {/* Transcript */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)' }}>
          <TranscriptPanel
            messages={messages}
            currentPartialTranscript={currentPartialTranscript}
            isAiSpeaking={isAiSpeaking}
            showSilenceDots={showSilenceDots}
          />
        </div>
      </main>

      {/* Controls */}
      <ControlBar
        isAiSpeaking={isAiSpeaking}
        isMicActive={isMicActive && !isAiSpeaking}
        canRepeat={canRepeat}
        repeatUsed={repeatUsed}
        onDoneAnswering={handleDoneAnswering}
        onRepeatQuestion={handleRepeatQuestion}
      />

      {/* End Interview Early modal */}
      {showEndEarlyModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 px-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        >
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-surface)' }}>
            <div className="w-11 h-11 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: '#FEF2F2' }}>
              <svg className="w-5 h-5" style={{ color: 'var(--danger)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              End interview early?
            </h3>
            <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
              You have completed approximately <strong style={{ color: 'var(--text-primary)' }}>{getCompletionPct()}%</strong> of the interview.
            </p>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              Your score will be rated proportionally — out of <strong style={{ color: 'var(--text-primary)' }}>{((getCompletionPct() / 100) * 5).toFixed(1)}</strong> instead of 5.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndEarlyModal(false)}
                className="flex-1 h-11 rounded-xl font-medium text-white text-sm"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Continue interview
              </button>
              <button
                onClick={() => endInterviewEarly(false)}
                className="flex-1 h-11 rounded-xl font-medium text-sm border"
                style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
              >
                End now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Smart pause modal — floats above control bar, frosted glass, non-blocking */}
      {showPauseModal && isMicActive && (
        <div
          className="fixed bottom-28 left-1/2 z-40 w-full max-w-sm px-4"
          style={{ transform: 'translateX(-50%)' }}
        >
          <div
            className="rounded-2xl px-5 py-4 shadow-2xl"
            style={{
              background: 'rgba(255,255,255,0.72)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.4)',
            }}
          >
            {/* Header row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {/* Animated pause icon */}
                <div className="flex items-center gap-0.5">
                  <span
                    className="block w-1 rounded-full"
                    style={{ height: 14, backgroundColor: 'var(--accent)', opacity: 0.7 }}
                  />
                  <span
                    className="block w-1 rounded-full"
                    style={{ height: 10, backgroundColor: 'var(--accent)', opacity: 0.5 }}
                  />
                  <span
                    className="block w-1 rounded-full"
                    style={{ height: 14, backgroundColor: 'var(--accent)', opacity: 0.7 }}
                  />
                </div>
                <p className="text-sm font-medium" style={{ color: 'rgba(0,0,0,0.75)' }}>
                  You went quiet — still there?
                </p>
              </div>
              {/* Countdown circle */}
              <div className="relative w-10 h-10 flex-shrink-0">
                <svg className="absolute inset-0 w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18" cy="18" r="15"
                    fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="2.5"
                  />
                  <circle
                    cx="18" cy="18" r="15"
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2.5"
                    strokeDasharray={`${(pauseCountdown / SMART_PAUSE_COUNTDOWN_SECS) * 94.2} 94.2`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dasharray 0.9s linear' }}
                  />
                </svg>
                <span
                  className="absolute inset-0 flex items-center justify-center text-sm font-bold"
                  style={{ color: 'var(--accent)' }}
                >
                  {pauseCountdown}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1 rounded-full overflow-hidden mb-4" style={{ backgroundColor: 'rgba(0,0,0,0.08)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(pauseCountdown / SMART_PAUSE_COUNTDOWN_SECS) * 100}%`,
                  backgroundColor: 'var(--accent)',
                  transition: 'width 0.9s linear',
                }}
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handlePauseModalExtend}
                disabled={(Date.now() - turnStartTimeRef.current) / 1000 >= MAX_TURN_SECS}
                className="flex-1 h-9 rounded-xl text-sm font-medium border transition-all disabled:opacity-40"
                style={{
                  borderColor: 'rgba(0,0,0,0.15)',
                  color: 'rgba(0,0,0,0.65)',
                  backgroundColor: 'rgba(255,255,255,0.5)',
                }}
              >
                I have more to say
              </button>
              <button
                onClick={handlePauseModalProceed}
                className="flex-1 h-9 rounded-xl text-sm font-medium text-white transition-all"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Move on →
              </button>
            </div>

            {(Date.now() - turnStartTimeRef.current) / 1000 >= MAX_TURN_SECS && (
              <p className="text-xs text-center mt-2" style={{ color: 'rgba(0,0,0,0.4)' }}>
                2-minute limit reached
              </p>
            )}
          </div>
        </div>
      )}

      {/* Leave modal */}
      {showLeaveModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 px-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        >
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-surface)' }}>
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              Are you sure you want to leave?
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              Your progress will not be saved if you leave now.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 h-11 rounded-xl font-medium text-white"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Stay
              </button>
              <button
                onClick={handleLeaveConfirm}
                className="flex-1 h-11 rounded-xl font-medium border"
                style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
