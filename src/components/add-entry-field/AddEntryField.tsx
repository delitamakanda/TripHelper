import { useId, useState } from 'react'
import { Button, Input } from 'react-aria-components'

interface AddEntryFieldProps {
    placeholder: string
    addLabel: string
    value: string
    onChange: (value: string) => void
    /** Retourne un message d'erreur (français) ou null si la saisie est acceptée. */
    onSubmit: (raw: string) => string | null
}

export function AddEntryField({ placeholder, addLabel, value, onChange, onSubmit }: AddEntryFieldProps) {
    const [error, setError] = useState<string | null>(null)
    const errorId = useId()

    const submit = () => setError(onSubmit(value))

    return (
        <div className="mt-2">
            <div className="flex gap-2">
                <Input
                    placeholder={placeholder}
                    aria-label={placeholder}
                    value={value}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    onChange={e => { setError(null); onChange(e.target.value) }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
                />
                <Button aria-label={addLabel} onClick={submit}>➕</Button>
            </div>
            <p id={errorId} role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
    )
}
