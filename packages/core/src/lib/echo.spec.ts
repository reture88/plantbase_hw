import { describe, expect, it } from 'vitest'
import { echo } from './echo'

describe('echo', () => {
  it('should return the same text it was given', () => {
    expect(echo('szia')).toEqual('szia')
  })

  it('should return an empty string when given an empty string', () => {
    expect(echo('')).toEqual('')
  })
})
