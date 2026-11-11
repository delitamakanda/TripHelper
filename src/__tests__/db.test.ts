import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toIso } from '../db.ts';

test('toIso garde une date ISO telle quelle', () => {
    assert.equal(toIso('2025-11-30'), '2025-11-30');
});

test('toIso convertit les formats français', () => {
    assert.equal(toIso('30/11/2025'), '2025-11-30');
    assert.equal(toIso('30-11-25'), '2025-11-30');
    assert.equal(toIso('Dim 30/11').slice(5), '11-30');
});

test('toIso renvoie la valeur d’origine si elle est illisible', () => {
    assert.equal(toIso('pas une date'), 'pas une date');
});
