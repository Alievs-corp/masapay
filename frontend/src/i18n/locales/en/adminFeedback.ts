import type { Messages } from '@/i18n/messages'
import type az from '../az/adminFeedback'

const en: Messages<typeof az> = {
  page: {
    title: 'Feedback',
    subtitle: 'The score out of 10 guests give the service after paying.',
    loading: 'Loading',
    loadFailed: 'Could not load the feedback.',
    empty: 'No feedback matches these filters.',
    noRestaurant: 'No restaurant is linked to you.',
  },
  score: '{{score}}/10',
  filters: {
    from: 'From',
    to: 'To',
    minScore: 'Minimum score',
    maxScore: 'Maximum score',
    quick: 'Score range',
    all: 'All',
    low: '1-6 (not satisfied)',
    high: '7-10',
    invalidRange: 'The start date cannot be after the end date.',
  },
  summary: {
    average: 'Average score',
    noAverage: '-',
    count: 'Feedback count',
  },
  columns: {
    score: 'Score',
    note: 'Note',
    noNote: 'No note',
    table: 'Table',
    reservation: 'Reservation {{code}}',
    time: 'Time',
    amount: 'Amount paid',
  },
}

export default en
