import { describe, expect, it } from 'vitest'
import { PrismaClient } from './index'

describe('@plantbase/db', () => {
  it('should re-export the generated Prisma client', () => {
    expect(PrismaClient).toBeDefined()
  })
})
