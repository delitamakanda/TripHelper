import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    buildRateUrl,
    describeRateStatus,
    parseRateResponse,
    readRatesCache,
    resolveCachedRate,
    writeCachedRate,
    type RateStatus,
} from '../utils/exchangeRate'

interface Settled {
    key: string
    pair: string
    rate: number | null
    fetchedAt: number | null
}

/**
 * Taux de change `from` → `to` (1 `from` = `rate` `to`).
 * Chargé au démarrage et à chaque changement de paire, avec repli sur le dernier taux connu (localStorage).
 */
export function useExchangeRate(from: string, to: string) {
    const pair = `${from}_${to}`
    const same = from === to
    const [tick, setTick] = useState(0)
    const [settled, setSettled] = useState<Settled | null>(null)
    const key = `${pair}#${tick}`

    // `settled` dans les dépendances : relire le cache après une écriture réussie
    const cached = useMemo(
        () => resolveCachedRate(readRatesCache(localStorage), from, to),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [from, to, settled],
    )

    useEffect(() => {
        if (from === to) return
        const controller = new AbortController()
        const finish = (rate: number | null) => {
            if (controller.signal.aborted) return
            const fetchedAt = rate !== null ? Date.now() : null
            if (rate !== null && fetchedAt !== null) writeCachedRate(localStorage, from, to, rate, fetchedAt)
            setSettled({ key, pair: `${from}_${to}`, rate, fetchedAt })
        }
        const apiKey = import.meta.env.VITE_EXCHANGE_RATES_API_KEY as string | undefined
        if (!apiKey) {
            finish(null)
            return () => controller.abort()
        }
        fetch(buildRateUrl(from, to, apiKey), { headers: { accept: 'application/json' }, signal: controller.signal })
            .then(response => (response.ok ? response.json() : null))
            .then(data => finish(parseRateResponse(data)))
            .catch(() => finish(null))
        return () => controller.abort()
    }, [from, to, key])

    const refresh = useCallback(() => setTick(t => t + 1), [])

    const fresh = settled && settled.pair === pair ? settled : null
    const loading = !same && settled?.key !== key
    let status: RateStatus
    let rate: number | null
    let fetchedAt: number | null
    if (same) {
        status = 'ok'
        rate = 1
        fetchedAt = null
    } else if (fresh && fresh.rate !== null) {
        status = loading ? 'loading' : 'ok'
        rate = fresh.rate
        fetchedAt = fresh.fetchedAt
    } else {
        rate = cached?.rate ?? null
        fetchedAt = cached?.fetchedAt ?? null
        status = loading ? 'loading' : cached ? 'stale' : 'error'
    }

    const message = describeRateStatus(status, from, to, rate, fetchedAt)
    return { rate, status, fetchedAt, message, loading, refresh }
}
