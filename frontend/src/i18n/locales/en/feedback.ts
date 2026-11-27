import type { Messages } from '@/i18n/messages'
import type az from '../az/feedback'

const en: Messages<typeof az> = {
  page: {
    title: 'How satisfied are you with the service?',
  },
  score: '{{score}}/10',
  whyTitle: 'Why were you not satisfied?',
  noteOptional: 'Your comment (optional)',
  notePlaceholder: 'Write a few words',
  noteRequired: 'Please tell us the reason.',
  submit: 'Send',
  thanks: 'Thank you for your feedback.',
  error: 'Could not send your feedback. Please try again.',
}

export default en
