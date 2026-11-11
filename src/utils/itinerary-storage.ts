export const ITINERARY_STORAGE_KEY = 'tripItinerary'

export type DayPlan = {
    day: string
    activities: string[]
    items: string[]
    budget: number
}

type ReadableStorage = Pick<Storage, 'getItem'>

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((v) => typeof v === 'string')

const isDayPlan = (value: unknown): value is DayPlan => {
    if (typeof value !== 'object' || value === null) return false
    const v = value as Record<string, unknown>
    return (
        typeof v.day === 'string' &&
        ISO_DAY.test(v.day) &&
        isStringArray(v.activities) &&
        isStringArray(v.items) &&
        typeof v.budget === 'number' &&
        Number.isFinite(v.budget)
    )
}

/**
 * Parse la valeur brute de `localStorage['tripItinerary']`.
 * Retourne `null` si absente ou inutilisable (JSON invalide, pas un tableau) ;
 * les entrées mal formées sont écartées, les autres conservées.
 */
export function parseItinerary(raw: string | null): DayPlan[] | null {
    if (raw === null) return null
    let data: unknown
    try {
        data = JSON.parse(raw)
    } catch {
        console.warn('Itinéraire sauvegardé illisible : ignoré')
        return null
    }
    if (!Array.isArray(data)) {
        console.warn('Itinéraire sauvegardé invalide (tableau attendu) : ignoré')
        return null
    }
    const valid = data.filter(isDayPlan).map(({ day, activities, items, budget }) => ({
        day,
        activities,
        items,
        budget,
    }))
    if (valid.length !== data.length) {
        console.warn(`${data.length - valid.length} jour(s) invalide(s) de l'itinéraire sauvegardé ignoré(s)`)
    }
    if (data.length > 0 && valid.length === 0) return null
    return valid
}

/** Lit l'itinéraire sauvegardé, sinon retourne `fallback`. Ne lève jamais. */
export function loadItinerary(
    fallback: DayPlan[],
    storage?: ReadableStorage,
): DayPlan[] {
    try {
        const store = storage ?? localStorage
        return parseItinerary(store.getItem(ITINERARY_STORAGE_KEY)) ?? fallback
    } catch (e) {
        console.warn('Lecture de l\'itinéraire sauvegardé impossible', e)
        return fallback
    }
}
