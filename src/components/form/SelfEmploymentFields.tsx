'use client';

import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BUSINESS_PROFIT_HELP, BUSINESS_PROFIT_LABEL, latestCompletedFinancialYear, australianBusinessDateKey, type SELF_EMPLOYMENT_FIELDS } from '@/lib/validations/self-employment';

type Field = typeof SELF_EMPLOYMENT_FIELDS[number];
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';

export function SelfEmploymentFields({ value, onChange, label = 'Business', disabled = false, errors = {} }: {
  value: unknown; onChange: (field: Field, value: string) => void; label?: string; disabled?: boolean; errors?: Partial<Record<Field, string>>;
}) {
  const data = record(value);
  const lastYear = latestCompletedFinancialYear();
  const selectedYear = Number(data.financialYearEnd);
  const years = [...new Set([...Array.from({ length: 15 }, (_, index) => lastYear - index), ...(Number.isInteger(selectedYear) && selectedYear >= 1901 && selectedYear <= lastYear ? [selectedYear] : [])])].sort((a, b) => b - a);
  const maxDate = australianBusinessDateKey();
  const error = (field: Field) => errors[field] ? <p role="alert" className="mt-1 text-sm text-red-600">{errors[field]}</p> : null;
  return <div className="space-y-4 rounded-xl border border-primary/15 bg-primary/5 p-4">
    <p className="text-sm text-slate-600">These details help your broker review your business income. Provide what you can. If you do not have a completed financial year, leave profit and financial year blank.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-semibold text-slate-700">Australian Business Number (ABN)<Input value={text(data.abn)} disabled={disabled} inputMode="numeric" autoComplete="off" maxLength={14} aria-label={`${label} ABN`} aria-invalid={Boolean(errors.abn)} className="mt-1.5" placeholder="11-digit ABN" onChange={event => onChange('abn', event.target.value.replace(/\s/g, ''))}/>{error('abn')}</label>
      <div className="text-sm font-semibold text-slate-700">Business commencement date<DatePicker allowClear value={text(data.commencedOn)} disabled={disabled} maxDate={maxDate} ariaLabel={`${label} commencement date`} onChange={value => onChange('commencedOn', value)}/><p className="mt-1 text-xs font-normal text-slate-500">When you started trading, which may differ from your ABN registration date.</p>{error('commencedOn')}</div>
      <div className="text-sm font-semibold text-slate-700">Financial year<Select value={text(data.financialYearEnd)} disabled={disabled} onValueChange={value => onChange('financialYearEnd', value === '__CLEAR__' ? '' : value)}><SelectTrigger aria-label={`${label} financial year`} aria-invalid={Boolean(errors.financialYearEnd)} className="mt-1.5"><SelectValue placeholder="Select financial year (optional)"/></SelectTrigger><SelectContent><SelectItem value="__CLEAR__">Not provided</SelectItem>{years.map(year => <SelectItem key={year} value={String(year)}>{year - 1}–{String(year).slice(-2)} (ending 30 June {year})</SelectItem>)}</SelectContent></Select>{error('financialYearEnd')}</div>
      <label className="text-sm font-semibold text-slate-700">{BUSINESS_PROFIT_LABEL}<CurrencyInput value={text(data.annualNetProfitBeforeTax)} allowNegative fractionDigits={2} disabled={disabled} aria-label={`${label} annual net profit before tax`} aria-invalid={Boolean(errors.annualNetProfitBeforeTax)} className="mt-1.5" placeholder="Profit or loss" onValueChange={value => onChange('annualNetProfitBeforeTax', value)}/>{error('annualNetProfitBeforeTax')}</label>
    </div><p className="text-xs leading-5 text-slate-500">{BUSINESS_PROFIT_HELP}</p>
  </div>;
}
