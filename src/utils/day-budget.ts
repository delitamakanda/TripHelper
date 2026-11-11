export type BudgetValidation = { ok: true; value: number } | { ok: false; error: string }

const MAX_BUDGET = 1e12

/** Valide la saisie du budget d'un jour : nombre fini ≥ 0 (entier ou décimal). */
export function validateBudget(raw: string): BudgetValidation {
    const text = raw.trim().replace(',', '.')
    if (text === '') return { ok: false, error: 'Saisissez un budget.' }
    if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(text)) return { ok: false, error: 'Le budget doit être un nombre.' }
    const value = Number(text)
    if (!Number.isFinite(value)) return { ok: false, error: 'Le budget doit être un nombre.' }
    if (value < 0) return { ok: false, error: 'Le budget ne peut pas être négatif.' }
    if (value > MAX_BUDGET) return { ok: false, error: 'Ce budget est trop élevé.' }
    return { ok: true, value }
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

/** Texte de confirmation de suppression d'un jour : nomme le jour et ce qui sera perdu. */
export function describeDayDeletion(label: string, activities: number, items: number, expense: number, currency: string): string {
    return (
        `Supprimer le jour « ${label} » ?\n\n` +
        `Seront perdus : ${plural(activities, 'activité', 'activités')}, ${plural(items, 'objet', 'objets')}, ` +
        `dépenses de ${expense} ${currency}, ainsi que le budget du jour.\n` +
        `Cette action est définitive.`
    )
}
