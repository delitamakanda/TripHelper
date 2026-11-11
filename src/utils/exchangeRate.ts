// Logique pure du taux de change (sans réseau, sans DOM) : testée par node:test.
// Convention : `rate` = nombre d'unités de `to` pour 1 unité de `from` (1 EUR ≈ rate TWD),
// ce qui correspond au champ `conversion_rate` de exchangerate-api (/pair/from/to).

export const RATES_STORAGE_KEY = 'exchangeRates'

export interface CachedRate {
    rate: number
    fetchedAt: number
}

export type RatesCache = Record<string, CachedRate>

export interface RateStorage {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
}

export type RateStatus = 'loading' | 'ok' | 'stale' | 'error'

export const pairKey = (from: string, to: string) => `${from}_${to}`

export const isValidRate = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0

export const buildRateUrl = (from: string, to: string, apiKey: string) =>
    `https://v6.exchangerate-api.com/v6/${encodeURIComponent(apiKey)}/pair/${encodeURIComponent(from)}/${encodeURIComponent(to)}`

/** Extrait `conversion_rate` d'une réponse exchangerate-api, ou null si la réponse est inutilisable. */
export const parseRateResponse = (data: unknown): number | null => {
    if (typeof data !== 'object' || data === null) return null
    const body = data as { result?: unknown; conversion_rate?: unknown }
    if (body.result === 'error') return null
    return isValidRate(body.conversion_rate) ? body.conversion_rate : null
}

export const readRatesCache = (storage: RateStorage): RatesCache => {
    try {
        const raw = storage.getItem(RATES_STORAGE_KEY)
        if (!raw) return {}
        const parsed: unknown = JSON.parse(raw)
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
        const cache: RatesCache = {}
        for (const [key, entry] of Object.entries(parsed as Record<string, unknown>)) {
            const e = entry as Partial<CachedRate> | null
            if (e && isValidRate(e.rate) && typeof e.fetchedAt === 'number' && Number.isFinite(e.fetchedAt)) {
                cache[key] = { rate: e.rate, fetchedAt: e.fetchedAt }
            }
        }
        return cache
    } catch {
        return {}
    }
}

export const writeCachedRate = (storage: RateStorage, from: string, to: string, rate: number, fetchedAt: number) => {
    if (!isValidRate(rate)) return
    try {
        const cache = readRatesCache(storage)
        cache[pairKey(from, to)] = { rate, fetchedAt }
        storage.setItem(RATES_STORAGE_KEY, JSON.stringify(cache))
    } catch {
        // stockage plein ou indisponible : le cache est facultatif
    }
}

/** Taux connu pour la paire : identique = 1, direct, sinon inverse de la paire opposée, sinon null. */
export const resolveCachedRate = (cache: RatesCache, from: string, to: string, now = Date.now()): CachedRate | null => {
    if (from === to) return { rate: 1, fetchedAt: now }
    const direct = cache[pairKey(from, to)]
    if (direct) return direct
    const reverse = cache[pairKey(to, from)]
    if (reverse) return { rate: 1 / reverse.rate, fetchedAt: reverse.fetchedAt }
    return null
}

const pad = (n: number) => String(n).padStart(2, '0')

export const formatRateTime = (ts: number) => {
    const d = new Date(ts)
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** « 12/11/2025 à 14:03 » */
export const formatRateDate = (ts: number) => {
    const d = new Date(ts)
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} à ${formatRateTime(ts)}`
}

/** Message d'état affiché sous le convertisseur (null = rien à dire). */
export const describeRateStatus = (
    status: RateStatus,
    from: string,
    to: string,
    rate: number | null,
    fetchedAt: number | null,
): string | null => {
    if (from === to) return null
    switch (status) {
        case 'loading':
            return rate !== null && fetchedAt !== null
                ? `Actualisation du taux… (dernier taux connu du ${formatRateDate(fetchedAt)})`
                : 'Chargement du taux de change…'
        case 'ok':
            return fetchedAt !== null ? `Taux mis à jour à ${formatRateTime(fetchedAt)}` : null
        case 'stale':
            return fetchedAt !== null
                ? `Taux hors ligne : dernier taux connu du ${formatRateDate(fetchedAt)}`
                : 'Taux hors ligne'
        case 'error':
            return `Taux indisponible pour ${from} → ${to}. Les montants convertis ne sont pas affichés.`
    }
}
