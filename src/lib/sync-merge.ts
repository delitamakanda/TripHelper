/**
 * Logique pure de synchronisation local (Dexie) / cloud (Firestore).
 *
 * Aucun import Firebase ni Dexie : ce module est testable avec `node:test`.
 * Règles :
 * - `updatedAt` est toujours un nombre (millisecondes epoch) ;
 * - une suppression est une « pierre tombale » (`deleted: true` + `updatedAt`) ;
 * - à `id` égal, la version avec le `updatedAt` le plus grand gagne ; à égalité,
 *   la suppression gagne ; à égalité sans suppression des deux côtés, la version
 *   locale est conservée (rien n'est écrit, ni d'un côté ni de l'autre).
 */
import type { DayPlan } from '../utils/itinerary-storage.ts'

export type ItemType = 'item' | 'activity'

export interface SyncRow {
    id: string
    updatedAt: number
    deleted?: boolean
}

export interface ChecklistRow extends SyncRow {
    day: string
    item: string
    checked: boolean
    type?: ItemType
}

export interface ExpenseRow extends SyncRow {
    day: string
    amount: number
    /** Budget du jour (devise de base) ; absent des anciennes lignes / anciens exports. */
    budget?: number
}

/** Une pierre tombale Firestore peut être purgée au bout de 30 jours (non appliqué automatiquement). */
export const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000

export function checklistId(day: string, item: string): string {
    return btoa(encodeURIComponent(`${day}|${item}`))
}

export function expenseId(day: string): string {
    return btoa(encodeURIComponent(day))
}

/** Convertit n'importe quelle valeur d'horodatage (nombre, Date, Timestamp Firestore, chaîne…) en millisecondes. */
export function normalizeUpdatedAt(value: unknown): number {
    if (typeof value === 'number') {
        return Number.isFinite(value) && value > 0 ? value : 0
    }
    if (value instanceof Date) {
        const t = value.getTime()
        return Number.isFinite(t) && t > 0 ? t : 0
    }
    if (typeof value === 'string') {
        const trimmed = value.trim()
        if (trimmed === '') return 0
        if (/^\d+(\.\d+)?$/.test(trimmed)) return normalizeUpdatedAt(Number(trimmed))
        return normalizeUpdatedAt(new Date(trimmed))
    }
    if (typeof value === 'object' && value !== null) {
        const v = value as { toMillis?: unknown; seconds?: unknown; nanoseconds?: unknown }
        if (typeof v.toMillis === 'function') {
            try {
                return normalizeUpdatedAt((v.toMillis as () => unknown).call(value))
            } catch {
                return 0
            }
        }
        if (typeof v.seconds === 'number' && Number.isFinite(v.seconds)) {
            const nanos = typeof v.nanoseconds === 'number' && Number.isFinite(v.nanoseconds) ? v.nanoseconds : 0
            return normalizeUpdatedAt(v.seconds * 1000 + Math.floor(nanos / 1e6))
        }
    }
    return 0
}

export function makeTombstone<T extends SyncRow>(row: T, ts: number): T {
    return { ...row, deleted: true, updatedAt: ts }
}

/**
 * Reset : toutes les lignes non plus récentes que `ts` deviennent des pierres
 * tombales datées de `ts`. Une ligne modifiée après `ts` (autre appareil) survit.
 */
export function applyReset<T extends SyncRow>(rows: T[], ts: number): T[] {
    return rows.map(row => (row.updatedAt > ts || (row.deleted === true && row.updatedAt === ts) ? row : makeTombstone(row, ts)))
}

export interface MergeResult<T> {
    /** Lignes à écrire en local (le cloud gagne ou n'existe pas en local). */
    toPut: T[]
    /** Lignes à écrire dans le cloud (le local gagne ou n'existe pas dans le cloud). */
    toPush: T[]
}

/** Compare deux versions : > 0 si `a` gagne, < 0 si `b` gagne, 0 si équivalentes. */
export function compareVersions(a: SyncRow, b: SyncRow): number {
    if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? 1 : -1
    const da = a.deleted === true
    const db = b.deleted === true
    if (da !== db) return da ? 1 : -1
    return 0
}

export function mergeRows<T extends SyncRow>(local: T[], cloud: T[]): MergeResult<T> {
    const localById = new Map(local.map(r => [r.id, r]))
    const cloudById = new Map(cloud.map(r => [r.id, r]))
    const toPut: T[] = []
    const toPush: T[] = []
    for (const [id, l] of localById) {
        const c = cloudById.get(id)
        if (!c) {
            toPush.push(l)
            continue
        }
        const cmp = compareVersions(l, c)
        if (cmp > 0) toPush.push(l)
        else if (cmp < 0) toPut.push(c)
    }
    for (const [id, c] of cloudById) {
        if (!localById.has(id)) toPut.push(c)
    }
    return { toPut, toPush }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/** Normalise un document Firestore `checklist` ; `null` si inexploitable. */
export function parseCloudChecklist(id: string, data: unknown): ChecklistRow | null {
    if (!isRecord(data)) return null
    const deleted = data.deleted === true
    if (typeof data.day !== 'string' || typeof data.item !== 'string') return null
    if (!deleted && data.item.trim() === '') return null
    const row: ChecklistRow = {
        id,
        day: data.day,
        item: data.item,
        checked: data.checked === true,
        // la clé `updateAt` (ancienne faute de frappe) est lue en repli
        updatedAt: normalizeUpdatedAt(data.updatedAt ?? data.updateAt),
    }
    if (data.type === 'item' || data.type === 'activity') row.type = data.type
    if (deleted) row.deleted = true
    return row
}

/** Normalise un document Firestore `expenses` ; `null` si inexploitable. */
export function parseCloudExpense(id: string, data: unknown): ExpenseRow | null {
    if (!isRecord(data) || typeof data.day !== 'string') return null
    const amount = Number(data.amount)
    const row: ExpenseRow = {
        id,
        day: data.day,
        amount: Number.isFinite(amount) ? amount : 0,
        updatedAt: normalizeUpdatedAt(data.updatedAt ?? data.updateAt),
    }
    const budget = parseBudget(data.budget)
    if (budget !== undefined) row.budget = budget
    if (data.deleted === true) row.deleted = true
    return row
}

/** Budget valide (nombre fini ≥ 0), sinon `undefined`. */
export function parseBudget(value: unknown): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined
    return value
}

export const isLive = (row: { deleted?: boolean }): boolean => row.deleted !== true

export function groupChecked(rows: ChecklistRow[]): Record<string, string[]> {
    const out: Record<string, string[]> = {}
    for (const row of rows) {
        if (!isLive(row)) continue
        out[row.day] = out[row.day] || []
        if (row.checked) out[row.day].push(row.item)
    }
    return out
}

/** Une dépense par jour : la plus récente gagne (ids hérités `day|` dédoublonnés). Une suppression récente masque les anciennes. */
export function groupExpenses(rows: ExpenseRow[]): Record<string, number> {
    const best = new Map<string, ExpenseRow>()
    for (const row of rows) {
        const cur = best.get(row.day)
        if (!cur || compareVersions(row, cur) > 0) best.set(row.day, row)
    }
    const out: Record<string, number> = {}
    for (const [day, row] of best) {
        if (isLive(row)) out[day] = row.amount
    }
    return out
}

/** Dernière ligne `expenses` de chaque jour (la plus récente gagne, suppression comprise). */
function bestExpenseByDay(rows: ExpenseRow[]): Map<string, ExpenseRow> {
    const best = new Map<string, ExpenseRow>()
    for (const row of rows) {
        const cur = best.get(row.day)
        if (!cur || compareVersions(row, cur) > 0) best.set(row.day, row)
    }
    return best
}

/**
 * Pierres tombales d'un jour supprimé : toutes les lignes `checklist` du jour
 * et ses lignes `expenses` (la ligne canonique est créée si absente), datées de `ts`.
 * Aucune ligne d'un autre jour.
 */
export function planDayDeletion(
    day: string,
    checklist: ChecklistRow[],
    expenses: ExpenseRow[],
    ts: number,
): { checklist: ChecklistRow[]; expenses: ExpenseRow[] } {
    const dayExpenses = expenses.filter(r => r.day === day)
    const canonical = expenseId(day)
    if (!dayExpenses.some(r => r.id === canonical)) dayExpenses.push({ id: canonical, day, amount: 0, updatedAt: 0 })
    return {
        checklist: checklist.filter(r => r.day === day).map(r => makeTombstone(r, ts)),
        expenses: dayExpenses.map(r => makeTombstone(r, ts)),
    }
}

/** Reconstruit l'itinéraire à partir des lignes locales, en retirant ce qui a été supprimé. */
export function applyRowsToItinerary(prev: DayPlan[], checklist: ChecklistRow[], expenses: ExpenseRow[]): DayPlan[] {
    const byDay: Record<string, { activities: string[]; items: string[] }> = {}
    const ensure = (day: string) => (byDay[day] = byDay[day] || { activities: [], items: [] })

    for (const day of Object.keys(groupExpenses(expenses))) ensure(day)

    const deletedIds = new Set<string>()
    for (const row of checklist) {
        if (!isLive(row)) {
            deletedIds.add(row.id)
            continue
        }
        if (!row.item || row.item.trim() === '') continue
        const bucket = ensure(row.day)
        if (row.type === 'activity') {
            if (!bucket.activities.includes(row.item)) bucket.activities.push(row.item)
        } else if (row.type === 'item') {
            if (!bucket.items.includes(row.item)) bucket.items.push(row.item)
        }
    }

    // un jour dont la ligne `expenses` la plus récente est une pierre tombale est supprimé
    const bestExpenses = bestExpenseByDay(expenses)
    const removedDays = new Set<string>()
    for (const [day, best] of bestExpenses) if (!isLive(best)) removedDays.add(day)
    const budgetOf = (day: string): number | undefined => {
        const best = bestExpenses.get(day)
        return best && isLive(best) ? parseBudget(best.budget) : undefined
    }

    const next = prev.filter(e => !removedDays.has(e.day))
    const existing = new Set(next.map(e => e.day))
    for (const day of Object.keys(byDay)) {
        if (!existing.has(day) && !removedDays.has(day)) next.push({ day, activities: byDay[day].activities, items: byDay[day].items, budget: budgetOf(day) ?? 3500 })
    }
    next.sort((a, b) => a.day.localeCompare(b.day))

    return next.map(entry => {
        const bucket = byDay[entry.day]
        const activities = bucket && bucket.activities.length > 0 ? bucket.activities : entry.activities
        const items = bucket && bucket.items.length > 0 ? bucket.items : entry.items
        return {
            ...entry,
            budget: budgetOf(entry.day) ?? entry.budget,
            activities: activities.filter(a => !deletedIds.has(checklistId(entry.day, a))),
            items: items.filter(i => !deletedIds.has(checklistId(entry.day, i))),
        }
    })
}

/**
 * Import JSON (remplacement) : les lignes du fichier sont écrites à `now`,
 * les lignes locales absentes du fichier deviennent des pierres tombales à `now`.
 * Les pierres tombales éventuelles du fichier sont ignorées.
 */
export function planImport(
    local: { checklist: ChecklistRow[]; expenses: ExpenseRow[] },
    data: { checklist?: unknown; expenses?: unknown },
    now: number,
    inferType: (day: string, item: string) => ItemType,
): { checklist: ChecklistRow[]; expenses: ExpenseRow[] } {
    const result = { checklist: [] as ChecklistRow[], expenses: [] as ExpenseRow[] }

    if (Array.isArray(data.checklist)) {
        const imported = new Map<string, ChecklistRow>()
        for (const raw of data.checklist as unknown[]) {
            if (!isRecord(raw) || typeof raw.day !== 'string' || typeof raw.item !== 'string' || raw.item.trim() === '') continue
            if (raw.deleted === true) continue
            const id = typeof raw.id === 'string' && raw.id !== '' ? raw.id : checklistId(raw.day, raw.item)
            const type: ItemType = raw.type === 'item' || raw.type === 'activity' ? raw.type : inferType(raw.day, raw.item)
            imported.set(id, { id, day: raw.day, item: raw.item, checked: raw.checked === true, type, updatedAt: now })
        }
        result.checklist.push(...imported.values())
        for (const row of local.checklist) {
            if (!imported.has(row.id) && isLive(row)) result.checklist.push(makeTombstone(row, now))
        }
    }

    if (Array.isArray(data.expenses)) {
        const imported = new Map<string, ExpenseRow>()
        for (const raw of data.expenses as unknown[]) {
            if (!isRecord(raw) || typeof raw.day !== 'string' || raw.deleted === true) continue
            const id = typeof raw.id === 'string' && raw.id !== '' ? raw.id : expenseId(raw.day)
            const amount = Number(raw.amount)
            const row: ExpenseRow = { id, day: raw.day, amount: Number.isFinite(amount) ? amount : 0, updatedAt: now }
            // ancien export sans budget : on garde celui de la ligne locale du jour, s'il existe
            const budget = parseBudget(raw.budget) ?? parseBudget(local.expenses.find(r => r.id === id && isLive(r))?.budget)
            if (budget !== undefined) row.budget = budget
            imported.set(id, row)
        }
        result.expenses.push(...imported.values())
        for (const row of local.expenses) {
            if (!imported.has(row.id) && isLive(row)) result.expenses.push(makeTombstone(row, now))
        }
    }

    return result
}
