import { FEEDBACK_NOTE_OPTIONAL_FROM } from './types'

// Rules of the satisfaction step: a score 1-10, a note required for 6 or lower.

export function noteRequired(score: number | null): boolean {
  return score !== null && score < FEEDBACK_NOTE_OPTIONAL_FROM
}

/** Whether the step may be sent: a score, and a note when the score needs one. */
export function canSubmitFeedback(score: number | null, note: string): boolean {
  if (score === null || score < 1 || score > 10) return false
  return !noteRequired(score) || note.trim().length > 0
}
