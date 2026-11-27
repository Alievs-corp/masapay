import type { Messages } from '@/i18n/messages'
import type az from '../az/adminFeedback'

const ru: Messages<typeof az> = {
  page: {
    title: 'Отзывы',
    subtitle:
      'Оценка обслуживания по 10-балльной шкале, которую гости ставят после оплаты.',
    loading: 'Загрузка',
    loadFailed: 'Не удалось загрузить отзывы.',
    empty: 'Нет отзывов по этим фильтрам.',
    noRestaurant: 'К вам не привязан ни один ресторан.',
  },
  score: '{{score}}/10',
  filters: {
    from: 'С',
    to: 'По',
    minScore: 'Минимальная оценка',
    maxScore: 'Максимальная оценка',
    quick: 'Диапазон оценок',
    all: 'Все',
    low: '1-6 (недовольны)',
    high: '7-10',
    invalidRange: 'Дата начала не может быть позже даты окончания.',
  },
  summary: {
    average: 'Средняя оценка',
    noAverage: '-',
    count: 'Количество отзывов',
  },
  columns: {
    score: 'Оценка',
    note: 'Комментарий',
    noNote: 'Без комментария',
    table: 'Стол',
    reservation: 'Бронь {{code}}',
    time: 'Время',
    amount: 'Оплачено',
  },
}

export default ru
