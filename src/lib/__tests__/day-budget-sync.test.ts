import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    applyRowsToItinerary,
    expenseId,
    makeTombstone,
    mergeRows,
    parseCloudExpense,
    planDayDeletion,
    planImport,
    type ChecklistRow,
    type ExpenseRow,
} from '../sync-merge.ts';

// Budget par jour et suppression d'un jour (le budget vit sur la ligne `expenses` du jour).

const row = (id: string, updatedAt: number, extra: Partial<ChecklistRow> = {}): ChecklistRow => ({
    id, day: '2025-12-01', item: id, checked: false, type: 'item', updatedAt, ...extra,
});
const exp = (day: string, updatedAt: number, extra: Partial<ExpenseRow> = {}): ExpenseRow => ({
    id: expenseId(day), day, amount: 0, updatedAt, ...extra,
});
const plan = (day: string, budget = 3500) => ({ day, activities: ['A'], items: ['I'], budget });

test('parseCloudExpense : lit le budget, tolère son absence ou une valeur invalide', () => {
    assert.equal(parseCloudExpense('x', { day: '2025-12-01', amount: 1, budget: 4000 })?.budget, 4000);
    assert.equal(parseCloudExpense('x', { day: '2025-12-01', amount: 1 })?.budget, undefined);
    assert.equal(parseCloudExpense('x', { day: '2025-12-01', amount: 1, budget: -5 })?.budget, undefined);
    assert.equal(parseCloudExpense('x', { day: '2025-12-01', amount: 1, budget: 'abc' })?.budget, undefined);
});

test('applyRowsToItinerary : le budget vient de la ligne expenses', () => {
    const out = applyRowsToItinerary([plan('2025-12-01')], [], [exp('2025-12-01', 10, { budget: 4000 }), exp('2025-12-02', 10, { budget: 100 })]);
    assert.equal(out.find(d => d.day === '2025-12-01')?.budget, 4000);
    assert.equal(out.find(d => d.day === '2025-12-02')?.budget, 100);
});

test('applyRowsToItinerary : sans budget dans la ligne, budget local conservé, sinon 3500', () => {
    const out = applyRowsToItinerary([plan('2025-12-01', 5200)], [], [exp('2025-12-01', 10), exp('2025-12-02', 10)]);
    assert.equal(out.find(d => d.day === '2025-12-01')?.budget, 5200);
    assert.equal(out.find(d => d.day === '2025-12-02')?.budget, 3500);
});

test('applyRowsToItinerary : un jour dont la ligne expenses est une pierre tombale est retiré', () => {
    const out = applyRowsToItinerary([plan('2025-12-01'), plan('2025-12-02')], [], [makeTombstone(exp('2025-12-01', 5), 20), exp('2025-12-02', 5)]);
    assert.deepEqual(out.map(d => d.day), ['2025-12-02']);
});

test('applyRowsToItinerary : un jour recréé après suppression (ligne plus récente) réapparaît', () => {
    const out = applyRowsToItinerary([], [], [makeTombstone(exp('2025-12-01', 5), 20), exp('2025-12-01', 30, { budget: 800 })]);
    assert.equal(out.length, 1);
    assert.equal(out[0].budget, 800);
});

test('applyRowsToItinerary : un jour supprimé n’est pas recréé par ses lignes checklist', () => {
    const out = applyRowsToItinerary([], [row('a', 5, { type: 'activity' })], [makeTombstone(exp('2025-12-01', 5), 20)]);
    assert.deepEqual(out, []);
});

test('planImport : budget importé, repli sur le budget local pour un ancien export', () => {
    const local = { checklist: [], expenses: [exp('2025-12-02', 1, { budget: 900 })] };
    const out = planImport(local, { expenses: [
        { day: '2025-12-01', amount: 5, budget: 4000 },
        { day: '2025-12-02', amount: 7 },
        { day: '2025-12-03', amount: 7, budget: -1 },
    ] }, 100, () => 'item');
    const byDay = Object.fromEntries(out.expenses.map(r => [r.day, r.budget]));
    assert.equal(byDay['2025-12-01'], 4000);
    assert.equal(byDay['2025-12-02'], 900);
    assert.equal(byDay['2025-12-03'], undefined);
});

test('planImport : un jour local absent du fichier devient une pierre tombale', () => {
    const local = { checklist: [], expenses: [exp('2025-12-02', 1, { budget: 900 })] };
    const out = planImport(local, { expenses: [{ day: '2025-12-01', amount: 0 }] }, 100, () => 'item');
    const removed = out.expenses.find(r => r.day === '2025-12-02');
    assert.equal(removed?.deleted, true);
    assert.equal(removed?.updatedAt, 100);
});

test('mergeRows : suppression de jour vs modification de budget, le plus récent gagne (ligne entière)', () => {
    const edited = exp('2025-12-01', 10, { budget: 4000 });
    const deleted = makeTombstone(exp('2025-12-01', 5, { budget: 3500 }), 20);
    assert.equal(mergeRows([edited], [deleted]).toPut[0].deleted, true);
    const recreated = exp('2025-12-01', 30, { budget: 100 });
    assert.deepEqual(mergeRows([deleted], [recreated]).toPut.map(r => r.budget), [100]);
    // budget et dépense sont sur la même ligne : le plus récent gagne pour les deux champs
    const a = exp('2025-12-01', 10, { budget: 4000, amount: 1 });
    const b = exp('2025-12-01', 11, { budget: 3500, amount: 2 });
    assert.deepEqual(mergeRows([a], [b]).toPut.map(r => [r.budget, r.amount]), [[3500, 2]]);
});

test('planDayDeletion : pierres tombales de toutes les lignes du jour, aucune d’un autre jour', () => {
    const cl = [row('a', 5), row('b', 5), row('c', 5, { day: '2025-12-02' })];
    const out = planDayDeletion('2025-12-01', cl, [exp('2025-12-01', 5), exp('2025-12-02', 5)], 50);
    assert.deepEqual(out.checklist.map(r => r.id), ['a', 'b']);
    assert.ok(out.checklist.every(r => r.deleted === true && r.updatedAt === 50));
    assert.deepEqual(out.expenses.map(r => r.day), ['2025-12-01']);
    assert.equal(out.expenses[0].deleted, true);
});

test('planDayDeletion : crée la pierre tombale expenses canonique si le jour n’a pas de ligne', () => {
    const out = planDayDeletion('2025-12-01', [], [], 50);
    assert.equal(out.expenses.length, 1);
    assert.equal(out.expenses[0].id, expenseId('2025-12-01'));
    assert.equal(out.expenses[0].deleted, true);
});
