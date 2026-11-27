import type { Allergen } from './types'

// Allergy safety of the pre-order (spec 11.2): a dish is flagged when its name,
// description or ingredients mention a keyword of an allergen the guest picked.
// Keywords cover az / en / ru menus. A keyword matches at the start of a word
// ("walnuts" yes, "donut" no for "nut"); a trailing "$" asks for the whole word
// (az "un" = flour, but not "unudulmaz"). Text and keywords are compared without
// case and accents, so "Süd" = "sud" and "й" = "и". A false warning is safer than
// a missed one, so stems are short. OTHER never matches: its free text goes to
// the staff instead.

export const ALLERGEN_KEYWORDS: Record<Exclude<Allergen, 'OTHER'>, string[]> = {
  NUTS: [
    'nuts$',
    'nut$',
    'tree nut',
    'walnut',
    'hazelnut',
    'almond',
    'pistachio',
    'cashew',
    'pecan',
    'macadamia',
    'praline',
    'nutella',
    'marzipan',
    'qoz',
    'fındıq',
    'badam',
    'püstə',
    'keşyu',
    'şabalıd',
    'орех',
    'фундук',
    'миндал',
    'фисташ',
    'кешью',
    'пекан',
    'грецк',
    'пралин',
  ],
  PEANUTS: [
    'peanut',
    'arachis',
    'araxis',
    'yer fındığı',
    'yerfındığı',
    'fıstıq',
    'арахис',
  ],
  MILK: [
    'milk',
    'lactose',
    'dairy',
    'cream',
    'butter',
    'cheese',
    'yogurt',
    'yoghurt',
    'mozzarella',
    'parmesan',
    'feta',
    'cheddar',
    'ricotta',
    'mascarpone',
    'ghee',
    'whey',
    'kefir',
    'latte',
    'cappuccino',
    'süd',
    'qaymaq',
    'xama',
    'kərə',
    'pendir',
    'yoqurt',
    'qatıq',
    'laktoz',
    'kəsmik',
    'ayran',
    'motal',
    'молок',
    'молоч',
    'сливк',
    'сливоч',
    'сыр',
    'творог',
    'йогурт',
    'кефир',
    'сметан',
    'лактоз',
    'моцарел',
    'пармезан',
    'брынз',
    'латте',
    'капучино',
  ],
  GLUTEN: [
    'gluten',
    'wheat',
    'flour',
    'bread',
    'pasta',
    'noodle',
    'barley',
    'rye$',
    'semolina',
    'couscous',
    'bulgur',
    'breadcrumb',
    'spaghetti',
    'dough',
    'pizza',
    'beer',
    'crouton',
    'tortilla',
    'lavash',
    'bun$',
    'burger',
    'qluten',
    'buğda',
    'un$',
    'arpa',
    'çovdar',
    'çörək',
    'makaron',
    'lavaş',
    'xəmir',
    'irmik',
    'bulqur',
    'kuskus',
    'əriştə',
    'pizza',
    'pivə',
    'qutab',
    'düşbərə',
    'xəngəl',
    'börək',
    'paxlava',
    'şəkərbura',
    'глютен',
    'пшени',
    'мук',
    'хлеб',
    'макарон',
    'лапш',
    'ячмен',
    'ржан',
    'манк',
    'булгур',
    'кускус',
    'тест',
    'паста',
    'пицц',
    'сухар',
    'лаваш',
    'пиво',
    'бургер',
    'пельмен',
    'вареник',
  ],
  EGGS: [
    'egg',
    'mayonnaise',
    'mayo$',
    'omelet',
    'omelette',
    'meringue',
    'aioli',
    'yumurta',
    'mayonez',
    'omlet',
    'kükü',
    'яйц',
    'яич',
    'майонез',
    'омлет',
    'безе',
  ],
  FISH: [
    'fish',
    'salmon',
    'tuna',
    'cod$',
    'trout',
    'sturgeon',
    'caviar',
    'anchov',
    'sardine',
    'mackerel',
    'herring',
    'sea bass',
    'perch',
    'carp$',
    'kutum',
    'balıq',
    'qızılbalıq',
    'somon',
    'tunes',
    'nərə',
    'kürü',
    'siyənək',
    'xəşəm',
    'sudak',
    'çəki',
    'рыб',
    'лосос',
    'семг',
    'тунец',
    'тунц',
    'форел',
    'осетр',
    'икр',
    'анчоус',
    'сардин',
    'скумбри',
    'сельд',
    'судак',
    'сазан',
    'кутум',
  ],
  SHELLFISH: [
    'shellfish',
    'seafood',
    'shrimp',
    'prawn',
    'crab',
    'lobster',
    'mussel',
    'oyster',
    'clam',
    'scallop',
    'squid',
    'octopus',
    'calamari',
    'crayfish',
    'krevet',
    'xərçəng',
    'midiya',
    'istridyə',
    'kalmar',
    'ahtapot',
    'dəniz məhsul',
    'кревет',
    'краб',
    'омар',
    'лобстер',
    'миди',
    'устриц',
    'гребеш',
    'кальмар',
    'осьмин',
    'рак$',
    'раки$',
    'раков',
    'морепродукт',
  ],
  SOY: [
    'soy',
    'soya',
    'tofu',
    'edamame',
    'miso',
    'teriyaki',
    'соя',
    'соев',
    'тофу',
    'мисо',
    'терияки',
  ],
  SESAME: [
    'sesame',
    'tahini',
    'tahina',
    'halva',
    'küncüt',
    'tahin',
    'xalva',
    'halva',
    'кунжут',
    'тахин',
    'халв',
  ],
}

/** Lower case without accents / diacritics ("Süd" -> "sud", "й" -> "и"). */
export function foldText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const PATTERNS: Partial<Record<Allergen, RegExp>> = Object.fromEntries(
  Object.entries(ALLERGEN_KEYWORDS).map(([allergen, words]) => {
    const parts = words.map((word) => {
      const whole = word.endsWith('$')
      const body = escapeRegExp(foldText(whole ? word.slice(0, -1) : word))
      return whole ? `${body}(?![\\p{L}\\p{N}])` : body
    })
    // Start of a word: beginning of the text or a non-letter before it.
    return [
      allergen,
      new RegExp(`(?<![\\p{L}\\p{N}])(?:${parts.join('|')})`, 'u'),
    ]
  }),
)

export interface DishText {
  name: string
  description?: string | null
  ingredients?: string | null
}

/** The picked allergens this dish mentions, in the order they were picked. */
export function matchAllergens(dish: DishText, picked: Allergen[]): Allergen[] {
  if (picked.length === 0) return []
  const text = foldText(
    [dish.name, dish.description ?? '', dish.ingredients ?? ''].join(' | '),
  )
  return picked.filter((allergen) => PATTERNS[allergen]?.test(text) ?? false)
}

/** True when at least one dish lists its ingredients (the menu has allergen data). */
export function menuHasIngredientData(
  categories: { items: { ingredients?: string | null }[] }[],
): boolean {
  return categories.some((category) =>
    category.items.some((item) => !!item.ingredients?.trim()),
  )
}
