import { describe, expect, it } from 'vitest'
import {
  foldText,
  matchAllergens,
  menuHasIngredientData,
} from './allergen-match'

describe('matchAllergens (pre-order allergy warnings)', () => {
  it('finds allergens in the ingredients, name and description', () => {
    expect(
      matchAllergens(
        { name: 'Qutab', description: null, ingredients: 'un, göyərti' },
        ['GLUTEN', 'MILK'],
      ),
    ).toEqual(['GLUTEN'])
    expect(
      matchAllergens({ name: 'Cheese burger', description: null }, [
        'MILK',
        'GLUTEN',
        'FISH',
      ]),
    ).toEqual(['MILK', 'GLUTEN'])
    expect(
      matchAllergens(
        { name: 'Салат', description: 'с грецким орехом и сыром' },
        ['NUTS', 'MILK', 'EGGS'],
      ),
    ).toEqual(['NUTS', 'MILK'])
  })

  it('ignores case and accents', () => {
    expect(matchAllergens({ name: 'SÜDLÜ şorba' }, ['MILK'])).toEqual(['MILK'])
    expect(foldText('Йогурт  Süd')).toBe(foldText('йогурт süd'))
  })

  it('matches at the start of a word only', () => {
    // "donut" / "coconut" are not tree nuts; "peanut" is PEANUTS, not NUTS.
    expect(matchAllergens({ name: 'Coconut donut' }, ['NUTS'])).toEqual([])
    expect(
      matchAllergens({ name: 'Peanut sauce' }, ['NUTS', 'PEANUTS']),
    ).toEqual(['PEANUTS'])
    expect(matchAllergens({ name: 'Walnuts salad' }, ['NUTS'])).toEqual([
      'NUTS',
    ])
  })

  it('needs the whole word for short keywords', () => {
    // az "un" (flour) must not match "unudulmaz".
    expect(matchAllergens({ name: 'Unudulmaz plov' }, ['GLUTEN'])).toEqual([])
    expect(
      matchAllergens({ name: 'Plov', ingredients: 'düyü, un, yağ' }, [
        'GLUTEN',
      ]),
    ).toEqual(['GLUTEN'])
  })

  it('never flags OTHER and returns nothing without picked allergens', () => {
    expect(matchAllergens({ name: 'Anything' }, ['OTHER'])).toEqual([])
    expect(matchAllergens({ name: 'Shrimp pasta' }, [])).toEqual([])
  })

  it('covers seafood, fish, eggs, soy and sesame in three languages', () => {
    const all = ['FISH', 'SHELLFISH', 'EGGS', 'SOY', 'SESAME'] as const
    expect(matchAllergens({ name: 'Krevet salatı' }, [...all])).toEqual([
      'SHELLFISH',
    ])
    expect(matchAllergens({ name: 'Qızılbalıq' }, [...all])).toEqual(['FISH'])
    expect(matchAllergens({ name: 'Омлет' }, [...all])).toEqual(['EGGS'])
    expect(matchAllergens({ name: 'Tofu with sesame' }, [...all])).toEqual([
      'SOY',
      'SESAME',
    ])
  })
})

describe('menuHasIngredientData', () => {
  it('is false when no dish lists its ingredients', () => {
    expect(
      menuHasIngredientData([
        { items: [{ ingredients: null }, { ingredients: '  ' }] },
      ]),
    ).toBe(false)
    expect(
      menuHasIngredientData([
        { items: [{}] },
        { items: [{ ingredients: 'un' }] },
      ]),
    ).toBe(true)
  })
})
