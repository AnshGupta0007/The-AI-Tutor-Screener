import type { Question, RubricDimension } from './types'

export const QUESTION_BANK: Question[] = [
  // Teaching Ability
  {
    id: 'TA-1',
    tag: 'TA',
    dimension: 'teaching_ability',
    text: "Okay — here's a live challenge. Explain what a fraction is to a 9-year-old, right now, as if I'm the student sitting across from you. Go ahead.",
    difficulty: 'hard',
  },
  {
    id: 'TA-2',
    tag: 'TA',
    dimension: 'teaching_ability',
    text: "How do you decide what examples or analogies to use when introducing a concept a student has never seen before?",
    difficulty: 'medium',
  },
  {
    id: 'TA-3',
    tag: 'TA',
    dimension: 'teaching_ability',
    text: "A 12-year-old says 'Why do I even need to learn algebra?' How do you respond — in the moment, not as a prepared speech?",
    difficulty: 'hard',
  },
  {
    id: 'TA-4',
    tag: 'TA',
    dimension: 'teaching_ability',
    text: "Walk me through how you would introduce the concept of multiplication to a child who only knows addition.",
    difficulty: 'medium',
  },

  // Patience
  {
    id: 'PA-1',
    tag: 'PA',
    dimension: 'patience',
    text: "Tell me about a time a student was really struggling — not just confused for a moment, but stuck on something no matter what you tried. Walk me through exactly what happened.",
    difficulty: 'medium',
  },
  {
    id: 'PA-2',
    tag: 'PA',
    dimension: 'patience',
    text: "Have you ever felt frustrated with a student? How did you handle that — internally and in the session?",
    difficulty: 'medium',
  },
  {
    id: 'PA-3',
    tag: 'PA',
    dimension: 'patience',
    text: "If a student keeps making the same mistake after you've corrected it three times, what do you do differently on attempt four?",
    difficulty: 'hard',
  },
  {
    id: 'PA-4',
    tag: 'PA',
    dimension: 'patience',
    text: "A student is staring at the problem and hasn't moved for 5 minutes. They say they don't understand. What do you do — what do you say first?",
    difficulty: 'medium',
  },

  // Communication
  {
    id: 'CO-1',
    tag: 'CO',
    dimension: 'communication',
    text: "How do you explain the same concept differently to a shy, quiet student versus a loud, confident one?",
    difficulty: 'medium',
  },
  {
    id: 'CO-2',
    tag: 'CO',
    dimension: 'communication',
    text: "You're mid-explanation and you sense the student isn't following. What do you do in the next 10 seconds — specifically?",
    difficulty: 'hard',
  },
  {
    id: 'CO-3',
    tag: 'CO',
    dimension: 'communication',
    text: "How do you communicate progress — or lack of progress — to a student's parent?",
    difficulty: 'medium',
  },

  // Warmth
  {
    id: 'WA-1',
    tag: 'WA',
    dimension: 'warmth',
    text: "What do you do when a student seems like they've completely given up — not just stuck, but emotionally checked out and defeated?",
    difficulty: 'medium',
  },
  {
    id: 'WA-2',
    tag: 'WA',
    dimension: 'warmth',
    text: "Tell me about a student who stands out to you. What made them memorable, and what did you do differently for them?",
    difficulty: 'easy',
  },
  {
    id: 'WA-3',
    tag: 'WA',
    dimension: 'warmth',
    text: "How do you celebrate a student's progress when the progress is small?",
    difficulty: 'easy',
  },
  {
    id: 'WA-4',
    tag: 'WA',
    dimension: 'warmth',
    text: "What do you do in the first session with a new student to make them feel comfortable?",
    difficulty: 'easy',
  },

  // Teaching Ability (continued)
  {
    id: 'TA-5',
    tag: 'TA',
    dimension: 'teaching_ability',
    text: "A student understands fractions but keeps getting confused when they encounter decimals. How do you connect the two concepts for them?",
    difficulty: 'medium',
  },
  {
    id: 'TA-6',
    tag: 'TA',
    dimension: 'teaching_ability',
    text: "You've explained a concept two different ways and the student still doesn't get it. What's your third approach?",
    difficulty: 'hard',
  },

  // Patience (continued)
  {
    id: 'PA-5',
    tag: 'PA',
    dimension: 'patience',
    text: "How do you handle a student who keeps getting distracted during the session — looking at their phone, fidgeting, losing focus?",
    difficulty: 'medium',
  },
  {
    id: 'PA-6',
    tag: 'PA',
    dimension: 'patience',
    text: "A student who was doing well suddenly starts regressing — making mistakes they had already mastered. How do you respond?",
    difficulty: 'medium',
  },

  // Communication (continued)
  {
    id: 'CO-4',
    tag: 'CO',
    dimension: 'communication',
    text: "How do you know when a student actually understands versus when they're just nodding along?",
    difficulty: 'medium',
  },
  {
    id: 'CO-5',
    tag: 'CO',
    dimension: 'communication',
    text: "Describe a time when a misunderstanding came up between you and a student or parent. How did you resolve it?",
    difficulty: 'medium',
  },

  // Warmth (continued)
  {
    id: 'WA-5',
    tag: 'WA',
    dimension: 'warmth',
    text: "A student tells you they're bad at math and they'll never get it. What do you say — and do — in that moment?",
    difficulty: 'medium',
  },
  {
    id: 'WA-6',
    tag: 'WA',
    dimension: 'warmth',
    text: "How do you keep yourself motivated when a student isn't making progress despite your best efforts?",
    difficulty: 'hard',
  },

  // Fluency (also serves as warm-up crossover)
  {
    id: 'FL-1',
    tag: 'FL',
    dimension: 'fluency',
    text: "Describe your teaching style to me in 3–4 sentences.",
    difficulty: 'easy',
  },
  {
    id: 'FL-2',
    tag: 'FL',
    dimension: 'fluency',
    text: "What's the biggest misconception students have about learning math, in your experience?",
    difficulty: 'medium',
  },

  // Warm-up (unscored)
  {
    id: 'WU-1',
    tag: 'WU',
    dimension: 'fluency',
    text: "Before we begin — what subject do you love teaching most, and what makes it click for you?",
    difficulty: 'easy',
    isWarmUp: true,
  },
  {
    id: 'WU-2',
    tag: 'WU',
    dimension: 'fluency',
    text: "Tell me a little about how you got into tutoring.",
    difficulty: 'easy',
    isWarmUp: true,
  },
  {
    id: 'WU-3',
    tag: 'WU',
    dimension: 'fluency',
    text: "What's the most satisfying moment you've had as a tutor — even a small one?",
    difficulty: 'easy',
    isWarmUp: true,
  },
  {
    id: 'WU-4',
    tag: 'WU',
    dimension: 'fluency',
    text: "How long have you been tutoring, and what kinds of students do you usually work with?",
    difficulty: 'easy',
    isWarmUp: true,
  },
]

export const WARM_UP_QUESTIONS = QUESTION_BANK.filter(q => q.isWarmUp)
export const CORE_QUESTIONS = QUESTION_BANK.filter(q => !q.isWarmUp)

const ALL_DIMENSIONS: RubricDimension[] = [
  'teaching_ability',
  'patience',
  'communication',
  'warmth',
  'fluency',
]

// CO-3 is the parent-communication question — must appear in every session
const PARENT_COMMUNICATION_ID = 'CO-3'

/**
 * Select 4–6 questions for a session ensuring:
 * - All 5 dimensions covered
 * - CO-3 (parent communication) always included
 * - No two adjacent questions from the same dimension
 * - Hard questions in the middle
 * - Easy questions first and last
 */
export function selectSessionQuestions(count: number = 5): Question[] {
  const selected: Question[] = []
  const byDimension: Record<RubricDimension, Question[]> = {
    teaching_ability: [],
    patience: [],
    communication: [],
    warmth: [],
    fluency: [],
  }

  // Bucket non-warm-up questions by dimension, excluding the guaranteed CO-3
  for (const q of CORE_QUESTIONS) {
    if (q.id !== PARENT_COMMUNICATION_ID) {
      byDimension[q.dimension].push(q)
    }
  }

  // Always include the parent-communication question
  const parentQ = CORE_QUESTIONS.find(q => q.id === PARENT_COMMUNICATION_ID)
  if (parentQ) selected.push(parentQ)

  // Ensure one question per remaining dimension (skip communication — CO-3 already covers it)
  for (const dim of ALL_DIMENSIONS) {
    if (dim === 'communication') continue // CO-3 already covers this dimension
    const pool = byDimension[dim]
    if (pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length)
      selected.push(pool[idx])
    }
  }

  // Fill remaining slots up to count with unselected questions (prefer medium/hard)
  if (count > selected.length) {
    const extras = CORE_QUESTIONS
      .filter(q => !selected.find(s => s.id === q.id))
      .sort((a, b) => {
        const order = { hard: 0, medium: 1, easy: 2 }
        return order[a.difficulty] - order[b.difficulty]
      })
    for (const q of extras) {
      if (selected.length >= count) break
      selected.push(q)
    }
  }

  // Sort: easy first, hard in middle, easy last
  const easy = selected.filter(q => q.difficulty === 'easy')
  const medium = selected.filter(q => q.difficulty === 'medium')
  const hard = selected.filter(q => q.difficulty === 'hard')

  const ordered: Question[] = []
  if (easy.length > 0) ordered.push(easy[0])
  ordered.push(...medium.slice(0, Math.floor(medium.length / 2)))
  ordered.push(...hard)
  ordered.push(...medium.slice(Math.floor(medium.length / 2)))
  if (easy.length > 1) ordered.push(easy[1])

  // Ensure no two adjacent from same dimension
  const result = deduplicateAdjacent(ordered)
  return result
}

function deduplicateAdjacent(questions: Question[]): Question[] {
  const result: Question[] = []
  for (const q of questions) {
    const last = result[result.length - 1]
    if (last && last.dimension === q.dimension) {
      // Insert this one before the last one
      result.splice(result.length - 1, 0, q)
    } else {
      result.push(q)
    }
  }
  return result
}

export function selectWarmUpQuestion(): Question {
  const idx = Math.floor(Math.random() * WARM_UP_QUESTIONS.length)
  return WARM_UP_QUESTIONS[idx]
}

export function getRemainingQuestions(askedIds: string[]): Partial<Record<RubricDimension, string[]>> {
  const remaining: Partial<Record<RubricDimension, string[]>> = {}
  for (const dim of ALL_DIMENSIONS) {
    const notAsked = CORE_QUESTIONS.filter(
      q => q.dimension === dim && !askedIds.includes(q.id)
    ).map(q => q.id)
    if (notAsked.length > 0) {
      remaining[dim] = notAsked
    }
  }
  return remaining
}
