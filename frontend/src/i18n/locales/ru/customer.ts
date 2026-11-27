import type { Messages } from '@/i18n/messages'
import type az from '../az/customer'

const ru: Messages<typeof az> = {
  orderStatus: {
    open: 'Открыт',
    awaiting_payment: 'Ожидает оплаты',
    partially_paid: 'Частично оплачен',
    paid: 'Оплачен',
    cancelled: 'Отменён',
  },
  kitchenStatus: {
    NEW: 'Принят',
    PREPARING: 'Готовится',
    READY: 'Готово',
  },
  orderItemList: {
    paid: 'Оплачено',
    empty: 'Пока ничего не заказано.',
  },
  billCard: {
    equalSplitPaid: 'Поровну: оплачено {{paid}} / {{total}} частей',
    byItems: 'По позициям (зачёркнутые)',
    equalSplitParts: 'Поровну ({{paid}} / {{total}} частей)',
    otherPayments: 'Другие оплаты',
    paidProgress: 'Оплаченная часть',
    fullyPaid: 'Счёт полностью оплачен. Спасибо!',
    cancelled: 'Ресторан отменил заказ. Оплата не требуется.',
    items: 'Позиции',
    serviceCharge: 'Плата за обслуживание',
    serviceChargePercent: 'Плата за обслуживание ({{percent}}%)',
    total: 'Итого',
    paid: 'Оплачено',
    balance: 'Остаток',
  },
  billStates: {
    loading: 'Счёт загружается',
    notFoundTitle: 'Стол не найден',
    errorTitle: 'Не удалось загрузить счёт',
    notFoundDescription:
      'Этот QR-код не относится ни к одному столу. Пожалуйста, отсканируйте QR-код на столе ещё раз.',
    errorDescription: 'Проверьте подключение к интернету и попробуйте снова.',
    retry: 'Попробовать снова',
    noOpenBill:
      'За этим столом пока нет открытого счёта. Он появится здесь после заказа.',
  },
  confirmOrder: {
    title: 'Вы уверены?',
    description: 'Эти позиции будут добавлены в счёт стола.',
    total: 'Итого',
    warning: 'После подтверждения заказ нельзя удалить.',
    back: 'Назад',
    sending: 'Отправляется...',
    confirm: 'Да, подтвердить',
  },
  dish: {
    add: 'Добавить',
    addAria: 'Добавить {{name}}',
    decreaseAria: 'Уменьшить {{name}}',
    quantityAria: 'Количество: {{name}}',
    increaseAria: 'Увеличить {{name}}',
    aboutAria: 'О блюде {{name}}',
    combo: 'Комбо',
    ingredients: 'Основной состав',
  },
  menuBrowser: {
    loading: 'Загрузка',
    search: 'Поиск блюд',
    searchPlaceholder: 'Поиск блюд',
    results: 'Результаты поиска',
    noResults: 'Ничего не найдено.',
    failed: 'Не удалось загрузить меню.',
    empty: 'Сегодня в меню нет блюд для заказа.',
    categories: 'Категории',
    nothingPicked: 'Пока ничего не выбрано.',
    decreasePickedAria: 'Уменьшить выбранное: {{name}}',
    increasePickedAria: 'Увеличить выбранное: {{name}}',
  },
  menuOrder: {
    restaurantClosed:
      'Ресторан сейчас не принимает онлайн-заказы. Пожалуйста, обратитесь к официанту.',
    conflict:
      'Некоторых позиций больше нет. Меню обновлено, проверьте корзину.',
    failed: 'Не удалось отправить заказ. Попробуйте снова.',
    cancelHint:
      'Чтобы отменить подтверждённый заказ, обратитесь к менеджеру ресторана.',
    newRound: 'Дозаказать',
    ordered: 'Ваш заказ добавлен в счёт стола.',
    basket: 'Корзина',
    confirm: 'Подтвердить заказ ({{amount}})',
  },
  upsell: {
    askOne: 'Хотите {{name}}?',
    askDefault: 'что-нибудь ещё',
    askMany: 'Хотите {{names}} или {{last}}?',
    title: 'Может, ещё и это?',
    askedDescription:
      'Если хотите, выберите количество, и оно будет добавлено в заказ.',
    description: 'Хорошо сочетается с вашим выбором.',
    addedAria: '{{name}}: добавлено',
    addAria: 'Добавить {{name}}',
    added: 'Добавлено',
    add: 'Добавить',
    free: 'Бесплатно',
    decreaseAria: 'Уменьшить {{name}}',
    quantityAria: 'Количество: {{name}}',
    increaseAria: 'Увеличить {{name}}',
    continue: 'Продолжить',
    noThanks: 'Нет, спасибо',
  },
  tableScreen: {
    welcome: 'Добро пожаловать',
    welcomeTo: 'Добро пожаловать в {{name}}',
    takeOrder: 'Что будете заказывать?',
    orderStatus: 'Статус вашего заказа',
    table: 'Стол',
  },
  orderPanel: {
    label: 'Статус заказа',
    cart: 'Корзина',
    progress: 'Готовится',
    done: 'Готово',
    toMenu: 'Перейти в меню',
    nothingInProgress: 'Сейчас ничего не готовится.',
    nothingDone: 'Пока ничего не готово.',
  },
  checkout: {
    items_one: '{{count}} позиция',
    items_few: '{{count}} позиции',
    items_many: '{{count}} позиций',
    items_other: '{{count}} позиции',
    ready: 'В корзине, можно заказывать',
    submit: 'Заказать',
    tabs: 'Разделы',
    menu: 'Меню',
    order: 'Заказ',
  },
  tablePage: {
    payment: 'Оплата',
  },
  invalidToken: {
    missingTitle: 'QR-код не распознан',
    missingDescription:
      'В этой ссылке нет данных о столе. Пожалуйста, отсканируйте QR-код на столе ещё раз.',
    malformedTitle: 'Недействительная ссылка',
    malformedDescription:
      'QR-код считан неверно. Пожалуйста, отсканируйте QR-код на столе ещё раз.',
    help: 'Если нужна помощь, обратитесь к сотруднику ресторана.',
  },
  notFound: {
    title: 'Страница не найдена',
    description:
      'Такой страницы нет. Начните со сканирования QR-кода на столе.',
  },
}

export default ru
