import { describe, expect, it } from 'vitest'
import { assertSelectOnly, enforceLimit, SqlGuardError } from './sql-guard'

describe('assertSelectOnly', () => {
  it('should accept a plain SELECT query', () => {
    expect(() => assertSelectOnly("SELECT * FROM products WHERE category = 'kaktusz'")).not.toThrow()
  })

  it('should accept a WITH ... SELECT (CTE) query', () => {
    expect(() =>
      assertSelectOnly('WITH cheap AS (SELECT * FROM products WHERE price < 1000) SELECT * FROM cheap'),
    ).not.toThrow()
  })

  it('should reject an empty query', () => {
    expect(() => assertSelectOnly('   ')).toThrow(SqlGuardError)
  })

  it('should reject queries containing line comments', () => {
    expect(() => assertSelectOnly("SELECT * FROM products -- WHERE stock > 0")).toThrow(SqlGuardError)
  })

  it('should reject queries containing block comments', () => {
    expect(() => assertSelectOnly('SELECT * FROM products /* sneaky */')).toThrow(SqlGuardError)
  })

  it('should reject stacked statements', () => {
    expect(() => assertSelectOnly('SELECT 1; DELETE FROM products')).toThrow(SqlGuardError)
  })

  it('should reject a bare DELETE statement', () => {
    expect(() => assertSelectOnly('DELETE FROM products')).toThrow(SqlGuardError)
  })

  it('should reject an UPDATE disguised with leading whitespace', () => {
    expect(() => assertSelectOnly('   UPDATE products SET stock = 0')).toThrow(SqlGuardError)
  })

  it('should reject DROP TABLE', () => {
    expect(() => assertSelectOnly('DROP TABLE products')).toThrow(SqlGuardError)
  })

  it('should not false-positive on Hungarian words containing short forbidden substrings', () => {
    expect(() => assertSelectOnly("SELECT * FROM products WHERE watering ILIKE '%gyakori%'")).not.toThrow()
  })
})

describe('enforceLimit', () => {
  it('should append a default LIMIT when none is present', () => {
    expect(enforceLimit('SELECT * FROM products')).toBe('SELECT * FROM products LIMIT 50')
  })

  it('should respect an existing LIMIT', () => {
    expect(enforceLimit('SELECT * FROM products LIMIT 10')).toBe('SELECT * FROM products LIMIT 10')
  })

  it('should strip a trailing semicolon before appending LIMIT', () => {
    expect(enforceLimit('SELECT * FROM products;')).toBe('SELECT * FROM products LIMIT 50')
  })
})
