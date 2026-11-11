import test from 'node:test'
import assert from 'node:assert/strict'
import { parseItinerary, loadItinerary } from '../itinerary-storage.ts'
import type { DayPlan } from '../itinerary-storage.ts'

const day = (d: string, budget = 5000): DayPlan => ({ day: d, activities: ['a'], items: ['b'], budget })
const fallback: DayPlan[] = [day('2025-11-30', 3500)]
const store = (value: string | null) => ({ getItem: () => value })

test.beforeEach(() => {
    test.mock.method(console, 'warn', () => {})
})
test.afterEach(() => test.mock.restoreAll())

test('aller-retour JSON valide', () => {
    const it = [day('2026-01-01'), { day: '2026-01-02', activities: [], items: [], budget: 0 }]
    assert.deepEqual(parseItinerary(JSON.stringify(it)), it)
    assert.deepEqual(loadItinerary(fallback, store(JSON.stringify(it))), it)
})

test('clé absente → repli', () => {
    assert.equal(parseItinerary(null), null)
    assert.equal(loadItinerary(fallback, store(null)), fallback)
})

test('JSON corrompu, null, objet, nombre → repli', () => {
    for (const raw of ['{oops', 'null', '{}', '42', '"x"']) {
        assert.equal(parseItinerary(raw), null, raw)
        assert.equal(loadItinerary(fallback, store(raw)), fallback, raw)
    }
})

test('entrées mal formées écartées, les autres gardées', () => {
    const good = day('2026-01-01')
    const raw = JSON.stringify([
        good,
        { ...good, budget: 'abc' },
        { ...good, activities: 'x' },
        { ...good, items: [1] },
        { ...good, day: '01/02' },
        null,
    ])
    assert.deepEqual(parseItinerary(raw), [good])
})

test('que des entrées invalides → repli', () => {
    assert.equal(parseItinerary(JSON.stringify([{ foo: 1 }])), null)
})

test('budget non fini rejeté', () => {
    assert.equal(parseItinerary('[{"day":"2026-01-01","activities":[],"items":[],"budget":null}]'), null)
})

test('getItem qui lève → repli', () => {
    const throwing = {
        getItem: () => {
            throw new Error('denied')
        },
    }
    assert.equal(loadItinerary(fallback, throwing), fallback)
})

test('tableau vide sauvegardé → [] (pas le repli)', () => {
    assert.deepEqual(loadItinerary(fallback, store('[]')), [])
})
