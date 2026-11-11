import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeDayDeletion, validateBudget } from '../day-budget.ts';

test('validateBudget : entiers, décimaux, zéro', () => {
    assert.deepEqual(validateBudget('4000'), { ok: true, value: 4000 });
    assert.deepEqual(validateBudget(' 12.5 '), { ok: true, value: 12.5 });
    assert.deepEqual(validateBudget('12,5'), { ok: true, value: 12.5 });
    assert.deepEqual(validateBudget('0'), { ok: true, value: 0 });
});

test('validateBudget : vide, non numérique, négatif, énorme refusés', () => {
    for (const bad of ['', '   ', 'abc', '1e5x', 'NaN', 'Infinity', '-5', '-0.1', '1e999', '9999999999999']) {
        assert.equal(validateBudget(bad).ok, false, bad);
    }
});

test('describeDayDeletion : nomme le jour et ce qui sera perdu', () => {
    const msg = describeDayDeletion('dim. 30/11', 3, 1, 250, 'TWD');
    assert.match(msg, /dim\. 30\/11/);
    assert.match(msg, /3 activités, 1 objet, dépenses de 250 TWD/);
});
