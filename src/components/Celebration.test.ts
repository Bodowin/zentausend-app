import { describe, expect, it } from 'vitest'
import { splitCelebrationScore } from './Celebration'

describe('splitCelebrationScore', () => {
  it('separates a formatted score from its label', () => {
    expect(splitCelebrationScore('1.500 Punkte')).toEqual({
      value: '1.500',
      label: 'Punkte gesichert',
    })
  })

  it('supports singular point wording', () => {
    expect(splitCelebrationScore('1 Punkt')).toEqual({
      value: '1',
      label: 'Punkte gesichert',
    })
  })

  it('keeps an unknown subtitle intact', () => {
    expect(splitCelebrationScore('Heiße Würfel!')).toEqual({
      value: 'Heiße Würfel!',
      label: '',
    })
  })
})
