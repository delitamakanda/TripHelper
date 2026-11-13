import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateNewEntry } from '../checklist-input.ts'

test('refuse une saisie vide ou faite d\'espaces', () => {
    assert.deepEqual(validateNewEntry('', []), { ok: false, error: 'empty' })
    assert.deepEqual(validateNewEntry('   \t ', ['a']), { ok: false, error: 'empty' })
})

test('supprime les espaces de début et de fin', () => {
    assert.deepEqual(validateNewEntry('  Cash NT$  ', []), { ok: true, value: 'Cash NT$' })
})

test('refuse un doublon exact', () => {
    assert.deepEqual(validateNewEntry('Cash NT$', ['Cash NT$']), { ok: false, error: 'duplicate' })
})

test('refuse un doublon insensible à la casse et aux espaces multiples', () => {
    assert.deepEqual(validateNewEntry(' cash   nt$ ', ['Cash NT$']), { ok: false, error: 'duplicate' })
})

test('accepte un texte distinct', () => {
    assert.deepEqual(validateNewEntry('Passeport', ['Cash NT$']), { ok: true, value: 'Passeport' })
})

test('gère les accents', () => {
    assert.deepEqual(validateNewEntry('café', ['Café']), { ok: false, error: 'duplicate' })
    assert.deepEqual(validateNewEntry('cafe', ['Café']), { ok: true, value: 'cafe' })
})
