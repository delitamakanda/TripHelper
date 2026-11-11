import { useCallback, useEffect, useRef, useState } from 'react'
import { collection, doc, getDocs, onSnapshot, writeBatch } from 'firebase/firestore'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { auth, firestore } from '../lib/firebase'
import { db } from '../db'
import {
    applyReset,
    checklistId,
    expenseId,
    makeTombstone,
    mergeRows,
    parseCloudChecklist,
    parseCloudExpense,
    type ChecklistRow,
    type ExpenseRow,
    type ItemType,
} from '../lib/sync-merge'
import type { DayPlan } from '../utils/itinerary-storage'

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'error'

const PENDING_RESET_KEY = 'pendingReset'
const BATCH_SIZE = 500
const SYNC_INTERVAL_MS = 300000 // 5 minutes

const readPendingReset = (): number | null => {
    try {
        const n = Number(localStorage.getItem(PENDING_RESET_KEY))
        return Number.isFinite(n) && n > 0 ? n : null
    } catch {
        return null
    }
}

/** Toutes les lignes locales (pierres tombales comprises), avec un `id` garanti. */
export async function loadLocalRows(): Promise<{ checklist: ChecklistRow[]; expenses: ExpenseRow[] }> {
    const [checklist, expenses] = await Promise.all([db.checklist.toArray(), db.expenses.toArray()])
    return {
        checklist: checklist.map(r => ({ ...r, id: r.id ?? checklistId(r.day, r.item) })),
        expenses: expenses.map(r => ({ ...r, id: r.id ?? expenseId(r.day) })),
    }
}

/** Fusionne des lignes cloud dans Dexie (la version la plus récente gagne) ; renvoie les lignes locales à pousser. */
async function mergeChecklistIntoDb(cloud: ChecklistRow[]): Promise<ChecklistRow[]> {
    return db.transaction('rw', db.checklist, async () => {
        const local = (await db.checklist.toArray()).map(r => ({ ...r, id: r.id ?? checklistId(r.day, r.item) }))
        const { toPut, toPush } = mergeRows(local, cloud)
        if (toPut.length > 0) await db.checklist.bulkPut(toPut)
        return toPush
    })
}

async function mergeExpensesIntoDb(cloud: ExpenseRow[]): Promise<ExpenseRow[]> {
    return db.transaction('rw', db.expenses, async () => {
        const local = (await db.expenses.toArray()).map(r => ({ ...r, id: r.id ?? expenseId(r.day) }))
        const { toPut, toPush } = mergeRows(local, cloud)
        if (toPut.length > 0) await db.expenses.bulkPut(toPut)
        return toPush
    })
}

const withPendingReset = <T extends { id: string; updatedAt: number; deleted?: boolean }>(rows: T[]): T[] => {
    const ts = readPendingReset()
    return ts === null ? rows : applyReset(rows, ts)
}

async function commitInBatches(items: Array<{ path: string; data: Record<string, unknown> }>) {
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = writeBatch(firestore)
        for (const { path, data } of items.slice(i, i + BATCH_SIZE)) {
            batch.set(doc(firestore, path), data, { merge: true })
        }
        await batch.commit()
    }
}

interface Options {
    /** Appelé avec toutes les lignes locales après chaque fusion cloud → local. */
    onData: (checklist: ChecklistRow[], expenses: ExpenseRow[]) => void
    getItinerary: () => DayPlan[]
}

/**
 * Orchestration de la synchro Firestore : auth anonyme, écoute temps réel,
 * synchro périodique / au focus / au retour réseau, suppressions et reset
 * (via pierres tombales, rejoués tant que le cloud n'est pas joignable).
 */
export function useCloudSync({ onData, getItinerary }: Options) {
    const [uid, setUid] = useState<string | null>(null)
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
    const [syncMessage, setSyncMessage] = useState('')
    const running = useRef(false)
    const rerun = useRef(false)
    const onDataRef = useRef(onData)
    const getItineraryRef = useRef(getItinerary)
    useEffect(() => {
        onDataRef.current = onData
        getItineraryRef.current = getItinerary
    })

    const emit = useCallback(async () => {
        const { checklist, expenses } = await loadLocalRows()
        onDataRef.current(checklist, expenses)
    }, [])

    const inferType = useCallback((row: ChecklistRow): ItemType => {
        if (row.type) return row.type
        const entry = getItineraryRef.current().find(e => e.day === row.day)
        return entry?.activities.includes(row.item) ? 'activity' : 'item'
    }, [])

    const syncNow = useCallback(async () => {
        // Jamais d'écriture sur `users/null/...` : sans uid, les pierres tombales restent en local.
        if (!uid) return
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            setSyncStatus('error')
            setSyncMessage('Hors ligne : les modifications seront synchronisées au retour du réseau.')
            return
        }
        if (running.current) {
            rerun.current = true
            return
        }
        running.current = true
        try {
            do {
                rerun.current = false
                setSyncStatus('syncing')
                setSyncMessage('')
                const resetTs = readPendingReset()
                const [clSnap, exSnap] = await Promise.all([
                    getDocs(collection(firestore, `users/${uid}/checklist`)),
                    getDocs(collection(firestore, `users/${uid}/expenses`)),
                ])
                const cloudChecklist: ChecklistRow[] = []
                clSnap.forEach(d => {
                    const row = parseCloudChecklist(d.id, d.data())
                    if (row) cloudChecklist.push(row)
                })
                const cloudExpenses: ExpenseRow[] = []
                exSnap.forEach(d => {
                    const row = parseCloudExpense(d.id, d.data())
                    if (row) cloudExpenses.push(row)
                })

                // Reset en attente : les lignes cloud plus anciennes deviennent des pierres tombales, à pousser aussi
                const resetChecklist = withPendingReset(cloudChecklist)
                const resetExpenses = withPendingReset(cloudExpenses)
                const pushChecklist = new Map(mergeRows(cloudChecklist, resetChecklist).toPut.map(r => [r.id, r]))
                for (const r of await mergeChecklistIntoDb(resetChecklist)) pushChecklist.set(r.id, r)
                const pushExpenses = new Map(mergeRows(cloudExpenses, resetExpenses).toPut.map(r => [r.id, r]))
                for (const r of await mergeExpensesIntoDb(resetExpenses)) pushExpenses.set(r.id, r)

                await commitInBatches([
                    ...[...pushChecklist.values()]
                        .filter(r => r.deleted === true || r.item.trim() !== '')
                        .map(r => ({
                            path: `users/${uid}/checklist/${r.id}`,
                            data: { day: r.day, item: r.item, checked: r.checked, type: inferType(r), updatedAt: r.updatedAt, deleted: r.deleted === true },
                        })),
                    ...[...pushExpenses.values()].map(r => ({
                        path: `users/${uid}/expenses/${r.id}`,
                        data: { day: r.day, amount: r.amount, updatedAt: r.updatedAt, deleted: r.deleted === true },
                    })),
                ])
                // le reset est appliqué au cloud : on peut oublier la demande (sauf si un autre reset l'a remplacée)
                if (resetTs !== null && readPendingReset() === resetTs) localStorage.removeItem(PENDING_RESET_KEY)
                await emit()
            } while (rerun.current)
            setSyncStatus('ok')
            setTimeout(() => setSyncStatus('idle'), 1200)
        } catch (error) {
            console.error('Failed to sync cloud', error)
            setSyncStatus('error')
            setSyncMessage('Synchronisation impossible pour le moment : vos données locales sont conservées.')
        } finally {
            running.current = false
        }
    }, [uid, emit, inferType])

    // Auth anonyme
    useEffect(() => {
        const off = onAuthStateChanged(auth, user => {
            if (user) setUid(user.uid)
            else signInAnonymously(auth).catch(console.error)
        })
        return off
    }, [])

    // Écoute temps réel : fusion (jamais clear + bulkPut), sans écriture vers le cloud
    useEffect(() => {
        if (!uid) return
        const onError = (error: unknown) => console.error('Firestore listener error', error)
        const off1 = onSnapshot(collection(firestore, `users/${uid}/checklist`), async snapshot => {
            const rows: ChecklistRow[] = []
            snapshot.forEach(d => {
                const row = parseCloudChecklist(d.id, d.data())
                if (row) rows.push(row)
            })
            await mergeChecklistIntoDb(withPendingReset(rows))
            await emit()
        }, onError)
        const off2 = onSnapshot(collection(firestore, `users/${uid}/expenses`), async snapshot => {
            const rows: ExpenseRow[] = []
            snapshot.forEach(d => {
                const row = parseCloudExpense(d.id, d.data())
                if (row) rows.push(row)
            })
            await mergeExpensesIntoDb(withPendingReset(rows))
            await emit()
        }, onError)
        return () => {
            off1()
            off2()
        }
    }, [uid, emit])

    // Synchro au démarrage, périodique, au focus et au retour du réseau
    useEffect(() => {
        if (!uid) return
        void syncNow()
        const interval = window.setInterval(() => void syncNow(), SYNC_INTERVAL_MS)
        const onFocus = () => void syncNow()
        const onVisible = () => {
            if (document.visibilityState === 'visible') void syncNow()
        }
        window.addEventListener('focus', onFocus)
        window.addEventListener('online', onFocus)
        document.addEventListener('visibilitychange', onVisible)
        return () => {
            window.clearInterval(interval)
            window.removeEventListener('focus', onFocus)
            window.removeEventListener('online', onFocus)
            document.removeEventListener('visibilitychange', onVisible)
        }
    }, [uid, syncNow])

    /** Supprime une activité / un objet : pierre tombale locale, propagée à la prochaine synchro possible. */
    const deleteChecklistEntry = useCallback(async (day: string, item: string, type: ItemType) => {
        const id = checklistId(day, item)
        const existing = await db.checklist.get(id)
        const base: ChecklistRow = existing
            ? { ...existing, id, type: existing.type ?? type }
            : { id, day, item, checked: false, type, updatedAt: 0 }
        await db.checklist.put(makeTombstone(base, Date.now()))
        void syncNow()
    }, [syncNow])

    /** Reset : pierres tombales locales, et mise en attente de celles du cloud (appliquées dès que possible). */
    const resetData = useCallback(async () => {
        const ts = Date.now()
        localStorage.setItem(PENDING_RESET_KEY, String(ts))
        await db.transaction('rw', db.checklist, db.expenses, async () => {
            const { checklist, expenses } = await loadLocalRows()
            await db.checklist.bulkPut(applyReset(checklist, ts))
            await db.expenses.bulkPut(applyReset(expenses, ts))
        })
        void syncNow()
    }, [syncNow])

    return { uid, syncStatus, syncMessage, syncNow, deleteChecklistEntry, resetData }
}
