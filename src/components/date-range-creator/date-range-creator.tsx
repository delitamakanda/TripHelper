import {useState} from "react";
import {Button} from "react-aria-components";
import { db } from '../../db'

export function DateRangeCreator({ onCreate } :{ onCreate: (days: Array<{ day: string, activities: string[], items: string[], budget: number
}>) => void }) {
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string >('');
    const [defaultBudget, setDefaultBudget] = useState<number>(3500);

    const createRange = async () => {
        if (!startDate && !endDate) {
            return;
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end < start) {
            return;
        }
        const output: Array<{ day: string, activities: string[], items: string[], budget: number }> = [];
        for (let i = new Date(start); i <= end; i.setDate(i.getDate() + 1)) {
            const isoDate = i.toISOString().slice(0, 10);
            output.push({
                day: isoDate,
                activities: [],
                items: [],
                budget: defaultBudget,
            });
        }
        // save to IndexedDB
        const checklistItems = output.map(item => ({ id: btoa(encodeURIComponent(`${item.day}|`)),day: item.day, item: '', checked: false, updatedAt: Date.now() }));
        await db.checklist.bulkAdd(checklistItems);
        onCreate(output);
        setStartDate('');
        setEndDate('');
    }
    return (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
            <div>
                <p className="text-sm font-medium mb-1">Début</p>
                <input type="date" className="border rounded px-2 py-1 text-sm w-full" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
                <p className="text-sm font-medium mb-1">Fin</p>
                <input type="date" className="border rounded px-2 py-1 text-sm w-full" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div>
                <p className="text-sm font-medium mb-1">Budget/jour (NT$)</p>
                <input type="number" className="border rounded px-2 py-1 text-sm w-full" value={defaultBudget} onChange={e => setDefaultBudget(parseInt(e.target.value)||0)} />
            </div>
            <div>
                <Button onClick={createRange}>Créer les jours</Button>
            </div>
        </div>
    )
}