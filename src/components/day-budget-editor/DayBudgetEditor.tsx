import { useEffect, useId, useState } from 'react'
import { validateBudget } from '../../utils/day-budget'

interface Props {
    budget: number
    currencyCode: string
    onCommit: (budget: number) => void | Promise<void>
}

/** Champ « Budget » d'un jour : enregistré à la validation (blur / Entrée), refusé si vide ou négatif. */
export function DayBudgetEditor({ budget, currencyCode, onCommit }: Props) {
    const id = useId()
    const errorId = `${id}-error`
    const [draft, setDraft] = useState(String(budget))
    const [error, setError] = useState('')

    // le budget peut changer de l'extérieur (synchro, import)
    useEffect(() => {
        setDraft(String(budget))
        setError('')
    }, [budget])

    const commit = () => {
        const result = validateBudget(draft)
        if (!result.ok) {
            setError(result.error)
            setDraft(String(budget))
            return
        }
        setError('')
        setDraft(String(result.value))
        if (result.value !== budget) void onCommit(result.value)
    }

    return (
        <div className="space-y-1">
            <label htmlFor={id} className="block text-sm">💰 Budget ({currencyCode})</label>
            <input
                id={id}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                className="border rounded px-2 py-2 text-sm w-full sm:w-48 min-h-11 dark:bg-black dark:text-white"
                value={draft}
                aria-invalid={error !== ''}
                aria-describedby={error ? errorId : undefined}
                onChange={e => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={e => {
                    if (e.key === 'Enter') commit()
                }}
            />
            {error && <p id={errorId} role="alert" className="text-xs text-red-700 dark:text-red-400">{error}</p>}
        </div>
    )
}
