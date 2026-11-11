import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildRateUrl, parseRateResponse, readRatesCache, writeCachedRate, resolveCachedRate,
    formatRateDate, describeRateStatus, RATES_STORAGE_KEY, type RateStorage,
} from '../exchangeRate.ts';

const fakeStorage = (initial: Record<string, string> = {}): RateStorage & { data: Record<string, string> } => {
    const data = { ...initial };
    return { data, getItem: k => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
};

test('buildRateUrl construit l’URL de la paire', () => {
    assert.equal(buildRateUrl('EUR', 'TWD', 'KEY'), 'https://v6.exchangerate-api.com/v6/KEY/pair/EUR/TWD');
});

test('parseRateResponse accepte une réponse valide', () => {
    assert.equal(parseRateResponse({ result: 'success', conversion_rate: 35.2 }), 35.2);
});

test('parseRateResponse rejette les réponses inutilisables', () => {
    assert.equal(parseRateResponse({ result: 'error', 'error-type': 'invalid-key' }), null);
    assert.equal(parseRateResponse({ result: 'error', conversion_rate: 3 }), null);
    assert.equal(parseRateResponse({ result: 'success' }), null);
    assert.equal(parseRateResponse({ conversion_rate: 0 }), null);
    assert.equal(parseRateResponse({ conversion_rate: NaN }), null);
    assert.equal(parseRateResponse({ conversion_rate: '35' }), null);
    assert.equal(parseRateResponse(null), null);
    assert.equal(parseRateResponse(undefined), null);
});

test('cache : écriture puis lecture par paire', () => {
    const s = fakeStorage();
    writeCachedRate(s, 'EUR', 'TWD', 35, 1000);
    writeCachedRate(s, 'EUR', 'JPY', 160, 2000);
    const cache = readRatesCache(s);
    assert.deepEqual(cache['EUR_TWD'], { rate: 35, fetchedAt: 1000 });
    assert.deepEqual(cache['EUR_JPY'], { rate: 160, fetchedAt: 2000 });
});

test('cache : un taux invalide n’est pas écrit', () => {
    const s = fakeStorage();
    writeCachedRate(s, 'EUR', 'TWD', 0, 1000);
    assert.equal(s.data[RATES_STORAGE_KEY], undefined);
});

test('cache corrompu ignoré', () => {
    assert.deepEqual(readRatesCache(fakeStorage({ [RATES_STORAGE_KEY]: '{oops' })), {});
    assert.deepEqual(readRatesCache(fakeStorage({ [RATES_STORAGE_KEY]: '[1,2]' })), {});
    const partial = fakeStorage({ [RATES_STORAGE_KEY]: JSON.stringify({ EUR_TWD: { rate: 'x', fetchedAt: 1 }, EUR_USD: { rate: 1.1, fetchedAt: 5 } }) });
    assert.deepEqual(readRatesCache(partial), { EUR_USD: { rate: 1.1, fetchedAt: 5 } });
});

test('resolveCachedRate : paire identique = 1', () => {
    assert.equal(resolveCachedRate({}, 'EUR', 'EUR', 42)?.rate, 1);
});

test('resolveCachedRate : direct, inversé, inconnu', () => {
    const cache = { EUR_TWD: { rate: 40, fetchedAt: 10 } };
    assert.deepEqual(resolveCachedRate(cache, 'EUR', 'TWD'), { rate: 40, fetchedAt: 10 });
    assert.deepEqual(resolveCachedRate(cache, 'TWD', 'EUR'), { rate: 0.025, fetchedAt: 10 });
    assert.equal(resolveCachedRate(cache, 'EUR', 'USD'), null);
});

test('formatRateDate au format français', () => {
    assert.equal(formatRateDate(new Date(2025, 10, 12, 14, 3).getTime()), '12/11/2025 à 14:03');
});

test('describeRateStatus', () => {
    const ts = new Date(2025, 10, 12, 14, 3).getTime();
    assert.equal(describeRateStatus('error', 'EUR', 'TWD', null, null), 'Taux indisponible pour EUR → TWD. Les montants convertis ne sont pas affichés.');
    assert.equal(describeRateStatus('stale', 'EUR', 'TWD', 35, ts), 'Taux hors ligne : dernier taux connu du 12/11/2025 à 14:03');
    assert.equal(describeRateStatus('ok', 'EUR', 'TWD', 35, ts), 'Taux mis à jour à 14:03');
    assert.equal(describeRateStatus('loading', 'EUR', 'TWD', null, null), 'Chargement du taux de change…');
    assert.equal(describeRateStatus('error', 'EUR', 'EUR', 1, null), null);
});
