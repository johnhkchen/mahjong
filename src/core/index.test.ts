import { describe, expect, it } from 'vitest'
import { ENGINE_NAME } from './index'

describe('core scaffold', () => {
  it('resolves and imports the core module', () => {
    expect(ENGINE_NAME).toBe('mahjong-core')
  })
})
