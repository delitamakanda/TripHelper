import Dexie, {type Table } from 'dexie'

export interface ChecklistItem {
    id?: string;
    day: string; // YYYY-MM-DD
    item: string;
    checked: boolean;
    updatedAt: number;
}

export interface ExpenseItem {
    id?: string;
    day: string; // YYYY-MM-DD
    amount: number;
    updatedAt: number;
}

function toIso(rawDate: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        return rawDate;
    }
    // formats FR type 'Dim 30/11', '30/11', '30/11/2025', '30-11-2025'
    const m = rawDate.match(/(?:(?:lun|mar|mer|jeu|ven|sam|dim)\.?\s*)?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/i);
    const currentYear = new Date().getFullYear();
    if (m) {
        const dd = parseInt(m[1], 10);
        const mm = parseInt(m[2], 10);
        let yyyy = m[3] ? parseInt(m[3], 10) : currentYear;
        if (yyyy < 100) yyyy += 2000;
        const d = new Date(Date.UTC(yyyy, mm - 1, dd));
        return d.toISOString().slice(0, 10);
    }

    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
        return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
    }

    return rawDate;
}

export class TripHelperDB extends Dexie {
    checklist!: Table<ChecklistItem, string>;
    expenses!: Table<ExpenseItem, string>;

    constructor() {
        super('TripHelperDB');
        this.version(1).stores({
            checklist: 'id, day, item',
            expenses: 'id, day',
        });

        this.version(2).stores({
            checklist: 'id, day, item',
            expenses: 'id, day',
        }).upgrade(async (tx) => {
            await tx.table('checklist').toCollection().modify((item) => {
                if (item.day) {
                    item.day = toIso(item.day);
                }
            })
            await tx.table('expenses').toCollection().modify((item) => {
                if (item.day) {
                    item.day = toIso(item.day);
                }
            })
        })
    }
}

export const db = new TripHelperDB();
export { toIso };