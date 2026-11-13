export type NewEntryResult =
    | { ok: true; value: string }
    | { ok: false; error: 'empty' | 'duplicate' }

/** Normalise un texte pour la comparaison : espaces réduits, sans casse. */
export function normalizeEntry(text: string): string {
    return text.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr')
}

/**
 * Valide la saisie d'une activité / d'un objet : refuse le vide et les
 * doublons (insensible à la casse et aux espaces superflus).
 */
export function validateNewEntry(raw: string, existing: string[]): NewEntryResult {
    const value = raw.trim()
    if (value === '') return { ok: false, error: 'empty' }
    const key = normalizeEntry(value)
    if (existing.some(e => normalizeEntry(e) === key)) return { ok: false, error: 'duplicate' }
    return { ok: true, value }
}
