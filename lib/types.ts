export type SessionStatus = 'pending' | 'active' | 'completed' | 'evaluated' | 'abandoned'

export type MessageRole = 'assistant' | 'user' | 'system'

export type Recommendation = 'strong_hire' | 'consider' | 'do_not_advance'

export type InterviewPhase = 'greeting' | 'warm_up' | 'core' | 'closing' | 'ended'

export type NextAction = 'ask_question' | 'follow_up' | 'close' | 'acknowledge_and_ask'

export type RubricDimension = 'teaching_ability' | 'patience' | 'communication' | 'warmth' | 'fluency'

export type QuestionTag = 'TA' | 'PA' | 'CO' | 'WA' | 'FL' | 'WU'

export interface Question {
  id: string
  tag: QuestionTag
  dimension: RubricDimension
  text: string
  difficulty: 'easy' | 'medium' | 'hard'
  isWarmUp?: boolean
}

export interface ConversationMessage {
  role: MessageRole
  content: string
  turnNumber?: number
  confidence?: number
}

export interface SessionData {
  id: string
  candidateName: string
  candidateEmail: string
  status: SessionStatus
  startedAt: string | null
  endedAt: string | null
  createdAt: string
  recordingPath: string | null
}

export interface EvaluationDimension {
  score: number
  justification: string
  excerpts: string[]
}

export interface EvaluationData {
  clarity: EvaluationDimension
  teaching_ability: EvaluationDimension
  patience: EvaluationDimension
  warmth: EvaluationDimension
  fluency: EvaluationDimension
  composite_score: number
  recommendation: Recommendation
  flags: string[]
  summary: string
}

export interface AdminReport {
  session: SessionData
  evaluation: EvaluationData
  transcript: ConversationMessage[]
  recordingAvailable: boolean
}

export interface CandidateReport {
  session: {
    candidateName: string
    date: string
    duration: number
    questionsAnswered: number
  }
  status: string
  nextSteps: string
}

export interface InterviewState {
  sessionId: string
  phase: InterviewPhase
  questionsAsked: string[]
  remainingQuestions: Partial<Record<RubricDimension, string[]>>
  consecutiveSkips: number
  turnNumber: number
  conversationHistory: ConversationMessage[]
  candidateName: string
}

export interface TranscriptSegment {
  transcript: string
  confidence: number
  isFinal: boolean
}

export interface InterviewResponse {
  responseText: string
  audioData?: string
  nextAction: NextAction
  questionId?: string
  phase: InterviewPhase
}

export interface FlagInfo {
  code: string
  label: string
  severity: 'red' | 'yellow' | 'green'
}

export const FLAG_INFO: Record<string, FlagInfo> = {
  THIN_ANSWER: { code: 'THIN_ANSWER', label: 'Thin Answers', severity: 'red' },
  STUDENT_BLAME: { code: 'STUDENT_BLAME', label: 'Student Blame', severity: 'red' },
  HEDGING_PATTERN: { code: 'HEDGING_PATTERN', label: 'Hedging Pattern', severity: 'yellow' },
  VERBOSE: { code: 'VERBOSE', label: 'Verbose', severity: 'yellow' },
  EXAMPLE_RICH: { code: 'EXAMPLE_RICH', label: 'Example Rich', severity: 'green' },
  SPONTANEOUS_EMPATHY: { code: 'SPONTANEOUS_EMPATHY', label: 'Spontaneous Empathy', severity: 'green' },
}
