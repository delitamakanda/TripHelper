import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    applyReset,
    applyRowsToItinerary,
    checklistId,
    expenseId,
    groupChecked,
    groupExpenses,
    makeTombstone,
    mergeRows,
    normalizeUpdatedAt,
    parseCloudChecklist,
    parseCloudExpense,
    planImport,
    type ChecklistRow,
    type ExpenseRow,
} from '../sync-merge.ts';

const row = (id: string, updatedAt: number, extra: Partial<ChecklistRow> = {}): ChecklistRow => ({
    id, day: '2025-12-01', item: id, checked: false, type: 'item', updatedAt, ...extra,
});

test('fusion : le local plus récent gagne et part au cloud', () => {
    const r = mergeRows([row('a', 20, { checked: true })], [row('a', 10)]);
    assert.deepEqual(r.toPush.map(x => x.id), ['a']);
    assert.equal(r.toPut.length, 0);
});

test('fusion : le cloud plus récent gagne et écrase le local plus ancien', () => {
    const r = mergeRows([row('a', 10)], [row('a', 20, { checked: true })]);
    assert.equal(r.toPush.length, 0);
    assert.equal(r.toPut[0].checked, true);
});

test('fusion : égalité sans suppression = rien à faire (local conservé)', () => {
    const r = mergeRows([row('a', 10, { checked: true })], [row('a', 10)]);
    assert.equal(r.toPush.length, 0);
    assert.equal(r.toPut.length, 0);
});

test('fusion : égalité, la suppression gagne des deux côtés', () => {
    const cloudDeleted = mergeRows([row('a', 10)], [row('a', 10, { deleted: true })]);
    assert.equal(cloudDeleted.toPut[0].deleted, true);
    const localDeleted = mergeRows([row('a', 10, { deleted: true })], [row('a', 10)]);
    assert.equal(localDeleted.toPush[0].deleted, true);
});

test('fusion : élément présent d’un seul côté', () => {
    const r = mergeRows([row('local', 1)], [row('cloud', 1)]);
    assert.deepEqual(r.toPush.map(x => x.id), ['local']);
    assert.deepEqual(r.toPut.map(x => x.id), ['cloud']);
});

test('fusion : une suppression plus récente que la modification l’emporte, et inversement (recréation)', () => {
    const del = mergeRows([row('a', 10)], [row('a', 20, { deleted: true })]);
    assert.equal(del.toPut[0].deleted, true);
    const recreate = mergeRows([row('a', 30)], [row('a', 20, { deleted: true })]);
    assert.equal(recreate.toPush[0].deleted, undefined);
    assert.equal(recreate.toPut.length, 0);
});

test('fusion : une modification locale hors ligne plus ancienne n’écrase pas le cloud', () => {
    const r = mergeRows([row('a', 5, { checked: true })], [row('a', 50, { checked: false })]);
    assert.equal(r.toPush.length, 0);
    assert.equal(r.toPut[0].checked, false);
});

test('normalizeUpdatedAt : nombre, Date, Timestamp, chaîne, valeurs invalides', () => {
    assert.equal(normalizeUpdatedAt(1700000000000), 1700000000000);
    assert.equal(normalizeUpdatedAt(new Date(1700000000000)), 1700000000000);
    assert.equal(normalizeUpdatedAt({ seconds: 1700000000, nanoseconds: 5_000_000 }), 1700000000005);
    assert.equal(normalizeUpdatedAt({ toMillis: () => 42 }), 42);
    assert.equal(normalizeUpdatedAt('1700000000000'), 1700000000000);
    assert.equal(normalizeUpdatedAt('2024-01-01T00:00:00.000Z'), Date.UTC(2024, 0, 1));
    assert.equal(normalizeUpdatedAt(undefined), 0);
    assert.equal(normalizeUpdatedAt(null), 0);
    assert.equal(normalizeUpdatedAt(NaN), 0);
    assert.equal(normalizeUpdatedAt('n’importe quoi'), 0);
    assert.equal(normalizeUpdatedAt({ toMillis: () => { throw new Error('boom'); } }), 0);
});

test('parseCloudChecklist : lit updatedAt (et l’ancienne clé updateAt), sans planter sur du sale', () => {
    const ok = parseCloudChecklist('x', { day: '2025-12-01', item: 'Passeport', checked: true, type: 'item', updatedAt: { seconds: 10, nanoseconds: 0 } });
    assert.equal(ok?.updatedAt, 10000);
    assert.equal(parseCloudChecklist('x', { day: 'd', item: 'i', updateAt: 7 })?.updatedAt, 7);
    assert.equal(parseCloudChecklist('x', { day: 'd', item: 'i' })?.updatedAt, 0);
    assert.equal(parseCloudChecklist('x', { day: 'd', item: '  ' }), null);
    assert.equal(parseCloudChecklist('x', null), null);
    assert.equal(parseCloudChecklist('x', { day: 'd', item: 'i', deleted: true, updatedAt: 3 })?.deleted, true);
});

test('parseCloudExpense : montant et horodatage normalisés', () => {
    const r = parseCloudExpense('e', { day: '2025-12-01', amount: '12.5', updatedAt: new Date(5) });
    assert.deepEqual(r, { id: 'e', day: '2025-12-01', amount: 12.5, updatedAt: 5 });
    assert.equal(parseCloudExpense('e', { amount: 1 }), null);
});

test('reset : tout devient pierre tombale avec le même horodatage, sauf ce qui est plus récent', () => {
    const rows = [row('a', 10), row('b', 20, { deleted: true }), row('c', 999)];
    const out = applyReset(rows, 100);
    assert.deepEqual(out.slice(0, 2).map(r => [r.deleted, r.updatedAt]), [[true, 100], [true, 100]]);
    assert.equal(out[2].deleted, undefined);
    assert.equal(out[2].updatedAt, 999);
    assert.deepEqual(makeTombstone(row('z', 1), 5), { ...row('z', 1), deleted: true, updatedAt: 5 });
});

test('reset puis fusion : le cloud ancien ne ressuscite rien', () => {
    const local = applyReset([row('a', 10)], 100);
    const cloud = applyReset([row('a', 50), row('b', 60)], 100);
    const r = mergeRows(local, cloud);
    assert.ok(r.toPut.every(x => x.deleted === true));
    assert.equal(r.toPut.length, 1); // b : pierre tombale connue seulement du cloud
});

test('id de dépense identique quel que soit l’appelant', () => {
    assert.equal(expenseId('2025-12-01'), btoa(encodeURIComponent('2025-12-01')));
    assert.equal(checklistId('2025-12-01', 'Café'), btoa(encodeURIComponent('2025-12-01|Café')));
});

test('groupChecked / groupExpenses ignorent les lignes supprimées et dédoublonnent par jour', () => {
    assert.deepEqual(groupChecked([row('a', 1, { checked: true }), row('b', 1, { checked: true, deleted: true })]), { '2025-12-01': ['a'] });
    const exp = (id: string, amount: number, updatedAt: number, deleted?: boolean): ExpenseRow => ({ id, day: 'd1', amount, updatedAt, deleted });
    assert.deepEqual(groupExpenses([exp('d1|', 0, 5), exp('d1', 40, 9)]), { d1: 40 });
    assert.deepEqual(groupExpenses([exp('d1', 40, 9), exp('d1|', 0, 12, true)]), {});
});

test('applyRowsToItinerary retire ce qui a été supprimé', () => {
    const prev = [{ day: '2025-12-01', activities: ['A', 'B'], items: ['X'], budget: 100 }];
    const rows = [
        row(checklistId('2025-12-01', 'A'), 1, { item: 'A', type: 'activity', deleted: true }),
        row(checklistId('2025-12-01', 'X'), 1, { item: 'X', type: 'item' }),
    ];
    const out = applyRowsToItinerary(prev, rows, []);
    assert.deepEqual(out[0].activities, ['B']);
    assert.deepEqual(out[0].items, ['X']);
});

test('planImport : remplacement avec pierres tombales, anciens fichiers acceptés, horodatage numérique', () => {
    const local = {
        checklist: [row(checklistId('d', 'old'), 5, { day: 'd', item: 'old' })],
        expenses: [{ id: expenseId('d'), day: 'd', amount: 3, updatedAt: 5 }] as ExpenseRow[],
    };
    const plan = planImport(local, {
        checklist: [{ day: 'd', item: 'new', checked: true, updatedAt: 'vieux' }, { day: 'd', item: 'gone', deleted: true }, { nope: 1 }],
        expenses: [{ day: 'd', amount: 8 }],
    }, 1000, () => 'activity');
    const live = plan.checklist.filter(r => !r.deleted);
    assert.deepEqual(live.map(r => [r.item, r.type, r.updatedAt, r.checked]), [['new', 'activity', 1000, true]]);
    assert.deepEqual(plan.checklist.filter(r => r.deleted).map(r => [r.item, r.updatedAt]), [['old', 1000]]);
    assert.deepEqual(plan.expenses.map(r => [r.id, r.amount, r.updatedAt]), [[expenseId('d'), 8, 1000]]);
    // un fichier sans section expenses laisse les dépenses intactes
    assert.equal(planImport(local, { checklist: [] }, 1, () => 'item').expenses.length, 0);
});
