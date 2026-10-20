import { describe, expect, it } from 'vitest'
import { setLang, t } from '../src/i18n'

describe('translations', () => {
  it('uses each language’s plural forms', () => {
    setLang('ru')
    expect([1, 3, 5, 21].map((count) => t('communesCount', { count }))).toEqual(['1 коммуна', '3 коммуны', '5 коммун', '21 коммуна'])
    setLang('uk')
    expect(t('addCommunes', { count: 2 })).toBe('Додати 2 комуни')
    setLang('fr')
    expect(t('communesCount', { count: 0 })).toBe('0 commune')
    setLang('en')
    expect(t('communesCount', { count: 1234 })).toBe('1,234 communes')
  })

  it('fills in names and keeps unknown placeholders', () => {
    setLang('en')
    expect(t('firstVisitedOn', { date: '3 May 2024' })).toBe('First visited on 3 May 2024.')
    expect(t('driveAccount')).toBe('Google Drive: {email}')
  })
})
