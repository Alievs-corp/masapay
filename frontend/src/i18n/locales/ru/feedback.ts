import type { Messages } from '@/i18n/messages'
import type az from '../az/feedback'

const ru: Messages<typeof az> = {
  page: {
    title: 'Насколько вы довольны обслуживанием?',
  },
  score: '{{score}}/10',
  whyTitle: 'Почему вы остались недовольны?',
  noteOptional: 'Ваш комментарий (необязательно)',
  notePlaceholder: 'Напишите пару слов',
  noteRequired: 'Пожалуйста, укажите причину.',
  submit: 'Отправить',
  thanks: 'Спасибо за ваш отзыв.',
  error: 'Не удалось отправить отзыв. Попробуйте ещё раз.',
}

export default ru
