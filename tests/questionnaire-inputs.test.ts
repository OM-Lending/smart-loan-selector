import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AustralianState } from '@prisma/client';
import { formatCurrencyInput, normalizeCurrencyInput } from '../src/lib/currency-input';
import { ApplicationSchema } from '../src/lib/validations/application';
import { checkAddressSelection, signAddress } from '../src/server/lib/address-selection';
import { isSameOriginRequest } from '../src/server/lib/request-origin';
import { AUSTRALIAN_STATES, normalizeAustralianLocation, PostcodeSchema } from '../src/lib/property-location';
import { checkPropertyLocationSelection, signPropertyLocation } from '../src/server/lib/property-location-selection';

const location = { postcode: '2000', suburb: 'Sydney', state: 'NSW' as const };
const buy = {
  goal: 'BUY', purchasePrice: '900000', deposit: '200000',
  propertyPostcode: location.postcode, propertySuburb: location.suburb, propertyState: location.state,
  propertyLocationSelection: { source: 'MANUAL', reason: 'NOT_FOUND' },
};

const base = {
  goal: 'REFINANCE', propertyUse: 'OWNER_OCCUPIED', propertyType: 'APARTMENT',
  propertyAddress: '12 Example Street, Sydney NSW 2000', propertyAddressSelection: { source: 'MANUAL', reason: 'NOT_FOUND' },
  currentLender: 'Westpac', propertyValue: '1000000', currentLoanBalance: '600000',
  repaymentStructure: 'P_AND_I', ratePreference: 'VARIABLE', employmentStatus: 'FULL_TIME',
  grossAnnualSalary: '120000', relationshipStatus: 'MARRIED', dependents: 1,
  firstName: 'Test', lastName: 'Customer', email: 'test@example.com', phone: '412345678',
};

test('currency display groups thousands without changing decimals or stored values', () => {
  for (const [raw, formatted] of [['1000000', '1,000,000'], ['1234.50', '1,234.50'], ['0', '0'], ['', ''], ['1234.', '1,234.']]) {
    assert.equal(formatCurrencyInput(raw), formatted);
    assert.equal(normalizeCurrencyInput(formatted), raw);
  }
  assert.equal(normalizeCurrencyInput('$1,234.50'), '1234.50');
  assert.equal(normalizeCurrencyInput('000123'), '123');
  assert.equal(normalizeCurrencyInput('.5'), '0.5');
});

test('currency input rejects negatives, text, exponent notation and excess precision', () => {
  for (const input of ['-100', '123abc', '1e5', '1.234', '10000000000', '1.2.3']) assert.equal(normalizeCurrencyInput(input), null);
  assert.equal(normalizeCurrencyInput('12.5', 0), null);
});

test('refinance requires a chosen lender and a lookup or deliberate manual address', () => {
  assert.equal(ApplicationSchema.safeParse(base).success, true);
  for (const change of [
    { currentLender: '' }, { currentLender: 'An invented lender' },
    { propertyAddress: '' }, { propertyAddressSelection: undefined },
    { propertyAddress: '12 Example Street, Sydney NSW' },
  ]) assert.equal(ApplicationSchema.safeParse({ ...base, ...change }).success, false);
  const parsed = ApplicationSchema.parse(base);
  assert.equal(parsed.propertyValue, 1000000);
  assert.equal(parsed.currentLoanBalance, 600000);
});

test('buy questionnaires do not require refinance-only address and lender fields', () => {
  assert.equal(ApplicationSchema.safeParse({ ...base, ...buy, currentLender: undefined, propertyAddress: undefined, propertyAddressSelection: undefined }).success, true);
});

test('selected liabilities require positive amounts, but optional liabilities can be empty', () => {
  assert.equal(ApplicationSchema.safeParse({ ...base, hasCreditCard: true, creditCardLimit: 0 }).success, false);
  assert.equal(ApplicationSchema.safeParse({ ...base, hasExistingLoans: true, existingMonthlyRepayment: '' }).success, false);
  assert.equal(ApplicationSchema.safeParse({ ...base, hasCreditCard: false, hasExistingLoans: false }).success, true);
});

test('an address selection receipt rejects edited addresses, forged tokens and changed keys', () => {
  const key = 'test-only-provider-key';
  const selection = { source: 'LOOKUP', token: signAddress(base.propertyAddress, key) };
  assert.equal(checkAddressSelection(base.propertyAddress, selection, key), null);
  assert.ok(checkAddressSelection('99 Different Street, Sydney NSW 2000', selection, key));
  assert.ok(checkAddressSelection(base.propertyAddress, { ...selection, token: 'forged' }, key));
  assert.ok(checkAddressSelection(base.propertyAddress, selection, 'another-key'));
  assert.ok(checkAddressSelection(base.propertyAddress, selection));
});

test('manual fallback requires an explicit reason and a complete address with postcode', () => {
  assert.equal(checkAddressSelection(base.propertyAddress, { source: 'MANUAL', reason: 'UNAVAILABLE' }), null);
  assert.ok(checkAddressSelection(base.propertyAddress, { source: 'MANUAL' }));
  assert.ok(checkAddressSelection('12 Example Street', { source: 'MANUAL', reason: 'NOT_FOUND' }));
});

test('address requests accept the LAN host even when Next uses an internal request URL', () => {
  assert.equal(isSameOriginRequest(new Request('http://localhost:3000/api/addresses/search', { headers: {
    origin: 'http://192.168.38.109:3000', host: '192.168.38.109:3000',
  } })), true);
  assert.equal(isSameOriginRequest(new Request('http://localhost:3000/api/addresses/search', { headers: {
    origin: 'http://localhost:3000', host: 'localhost:3000',
  } })), true);
});

test('address requests use the public HTTPS origin behind a reverse proxy', () => {
  assert.equal(isSameOriginRequest(new Request('http://localhost:3000/api/addresses/search', { headers: {
    origin: 'https://loans.example.com', host: 'localhost:3000',
    'x-forwarded-host': 'loans.example.com', 'x-forwarded-proto': 'https',
  } })), true);
});

test('address requests still reject unrelated origins, ports, schemes and missing origin', () => {
  for (const origin of ['http://attacker.example', 'http://192.168.38.109:4000', 'https://192.168.38.109:3000', 'null', 'not-a-url', 'http://192.168.38.109:3000/path']) {
    assert.equal(isSameOriginRequest(new Request('http://localhost:3000/api/addresses/search', { headers: {
      origin, host: '192.168.38.109:3000',
    } })), false, origin);
  }
  assert.equal(isSameOriginRequest(new Request('http://localhost:3000/api/addresses/search')), false);
});

test('buying requires the postcode, suburb, state and an explicit location selection', () => {
  assert.equal(ApplicationSchema.safeParse({ ...base, ...buy }).success, true);
  for (const change of [
    { propertyPostcode: '' }, { propertyPostcode: '0000' }, { propertyPostcode: '200' },
    { propertySuburb: '' }, { propertyState: '' }, { propertyState: 'INVALID' }, { propertyLocationSelection: undefined },
  ]) assert.equal(ApplicationSchema.safeParse({ ...base, ...buy, ...change }).success, false);
  assert.equal(PostcodeSchema.parse('0830'), '0830');
});

test('location receipts bind suburb and state as well as postcode', () => {
  const key = 'test-only-location-key';
  const selection = { source: 'LOOKUP', token: signPropertyLocation(location, key) };
  assert.equal(checkPropertyLocationSelection(location, selection, key), null);
  assert.ok(checkPropertyLocationSelection({ ...location, suburb: 'Haymarket' }, selection, key));
  assert.ok(checkPropertyLocationSelection({ ...location, state: 'VIC' }, selection, key));
  assert.ok(checkPropertyLocationSelection({ ...location, postcode: '2010' }, selection, key));
  assert.ok(checkPropertyLocationSelection(location, { ...selection, token: signAddress('2000 — Sydney, NSW', key) }, key));
  assert.equal(checkPropertyLocationSelection(location, { source: 'MANUAL', reason: 'UNAVAILABLE' }), null);
});

test('provider location results normalize Australian states and reject incomplete or foreign results', () => {
  const raw = { country_code: 'au', result_type: 'suburb', suburb: 'Sydney', state: 'New South Wales', postcode: '2000' };
  assert.deepEqual(normalizeAustralianLocation(raw), location);
  assert.deepEqual(normalizeAustralianLocation({ ...raw, state: undefined, state_code: 'AU-NSW' }), location);
  assert.equal(normalizeAustralianLocation({ ...raw, country_code: 'nz' }), null);
  assert.equal(normalizeAustralianLocation({ ...raw, postcode: undefined }), null);
  assert.equal(normalizeAustralianLocation({ ...raw, state: undefined }), null);
  assert.equal(normalizeAustralianLocation({ ...raw, suburb: undefined }), null);
  assert.equal(normalizeAustralianLocation({ ...raw, result_type: 'street' }), null);
  assert.deepEqual(normalizeAustralianLocation({ country_code: 'au', result_type: 'postcode', city: 'Palmerston', state_code: 'NT', postcode: '0830' }), { postcode: '0830', suburb: 'Palmerston', state: 'NT' });
});

test('location validation uses the same state codes as the database enum', () => {
  assert.deepEqual([...AUSTRALIAN_STATES].sort(), Object.values(AustralianState).sort());
});
