'use client';

import { AddressInput } from '@/components/form/AddressInput';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Property = Record<string, unknown>;
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const controlClass = 'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm focus:border-primary disabled:bg-slate-100';
const text = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const investmentFields = ['marketValue', 'lender', 'loanLimit', 'loanBalance', 'loanStartDate', 'rentalPerWeek', 'leasedThrough'];

export function OwnedPropertiesForm({ value, onChange, disabled }: { value: unknown; onChange: (value: Record<string, unknown>) => void; disabled: boolean }) {
  const data = record(value);
  const items: Property[] = Array.isArray(data.items) ? data.items.map(record) : [];
  const legacy = Object.entries(data).filter(([key, value]) => key !== 'items' && typeof value === 'string' && value.trim());
  function update(index: number, key: string, value: unknown) {
    onChange({ ...data, items: items.map((item, i) => {
      if (i !== index) return item;
      const next = { ...item, [key]: value };
      if (key === 'use' && value !== 'INVESTMENT') for (const field of investmentFields) delete next[field];
      return next;
    }) });
  }
  return <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
    <h2 className="text-xl font-bold text-slate-900">Properties you own</h2>
    <p className="mt-1 text-sm leading-6 text-slate-600">Add each property if you wish. All fields are optional. You currently have {items.length} {items.length === 1 ? 'property' : 'properties'} listed.</p>
    {legacy.length > 0 && <div className="mt-4 rounded-xl bg-slate-50 p-4"><h3 className="text-sm font-semibold">Previously saved property information</h3><p className="mt-1 text-xs text-slate-500">These earlier notes are retained for your broker. Add structured property details below if you wish.</p>{legacy.map(([key, value]) => <p key={key} className="mt-2 whitespace-pre-wrap text-sm">{String(value)}</p>)}</div>}
    <div className="mt-4 space-y-4">{items.map((item, index) => <fieldset key={index} className="rounded-xl border border-slate-200 p-4" disabled={disabled}>
      <legend className="px-2 font-semibold">Property {index + 1}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><p className="text-sm font-semibold">Property use</p><Select value={text(item.use)} disabled={disabled} onValueChange={value => update(index, 'use', value === '__CLEAR__' ? '' : value)}><SelectTrigger aria-label={`Property ${index + 1} use`}><SelectValue placeholder="Select property use (optional)" /></SelectTrigger><SelectContent><SelectItem value="__CLEAR__">Not provided</SelectItem><SelectItem value="OWNER_OCCUPIED">Owner-occupied home</SelectItem><SelectItem value="INVESTMENT">Investment property</SelectItem></SelectContent></Select></div>
        <div><p className="text-sm font-semibold">Property address</p><AddressInput value={text(item.address)} selection={item.selection} label={`Property ${index + 1} address`} disabled={disabled} className={controlClass} onChange={(address, selection) => onChange({ ...data, items: items.map((row, i) => i === index ? { ...row, address, selection } : row) })}/></div>
        {(['propertyType', 'bedrooms', 'ownership'] as const).map(key => <label key={key} className="text-sm font-semibold">{key === 'propertyType' ? 'Property type' : key === 'bedrooms' ? 'Number of bedrooms' : 'Ownership'}<input className={controlClass} value={text(item[key])} maxLength={500} inputMode={key === 'bedrooms' ? 'numeric' : 'text'} onChange={event => update(index, key, event.target.value)} placeholder={key === 'ownership' ? 'Applicant 1: 50%; Applicant 2: 50%' : undefined}/>{key === 'ownership' && <span className="mt-1 block text-xs font-normal text-slate-500">List each owner and their share, for example Applicant 1: 50%; Applicant 2: 50%.</span>}</label>)}
        {item.use === 'INVESTMENT' && <>
          {([['marketValue', 'Estimated market value (AUD)'], ['loanLimit', 'Loan limit (AUD)'], ['loanBalance', 'Current loan balance (AUD)'], ['rentalPerWeek', 'Rental income per week (AUD)']] as const).map(([key, label]) => <label key={key} className="text-sm font-semibold">{label}<CurrencyInput value={text(item[key])} fractionDigits={2} className={controlClass} aria-label={`Property ${index + 1} ${label}`} disabled={disabled} onValueChange={value => update(index, key, value)}/></label>)}
          <label className="text-sm font-semibold">Lender<input className={controlClass} value={text(item.lender)} maxLength={120} onChange={event => update(index, 'lender', event.target.value)}/></label>
          <div className="text-sm font-semibold">Loan start date<DatePicker allowClear value={text(item.loanStartDate)} disabled={disabled} ariaLabel={`Property ${index + 1} loan start date`} onChange={value => update(index, 'loanStartDate', value)}/></div>
          <div><p className="text-sm font-semibold">Leasing arrangement</p><Select value={text(item.leasedThrough)} disabled={disabled} onValueChange={value => update(index, 'leasedThrough', value === '__CLEAR__' ? '' : value)}><SelectTrigger aria-label={`Property ${index + 1} leasing arrangement`}><SelectValue placeholder="Select leasing arrangement (optional)" /></SelectTrigger><SelectContent><SelectItem value="__CLEAR__">Not provided</SelectItem><SelectItem value="REAL_ESTATE_AGENT">Leased through a real estate agent</SelectItem><SelectItem value="PRIVATE">Privately leased</SelectItem></SelectContent></Select></div>
        </>}
      </div><button type="button" disabled={disabled} className="mt-4 text-sm font-semibold text-red-700" onClick={() => onChange({ ...data, items: items.filter((_, i) => i !== index) })}>Remove property</button>
    </fieldset>)}</div>
    <button type="button" disabled={disabled || items.length >= 50} className="mt-4 rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50" onClick={() => onChange({ ...data, items: [...items, {}] })}>Add property</button>
  </section>;
}
