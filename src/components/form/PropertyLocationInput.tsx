'use client';

import { useEffect, useId, useState } from 'react';
import { CheckCircle2, LoaderCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AddressSelectionSchema, type AddressSelection } from '@/lib/validations/address';
import { AUSTRALIAN_STATES, type LocationSuggestion } from '@/lib/property-location';

type Values = { postcode: string; suburb: string; state: string };
type Props = Values & { selection?: unknown; invalid?: boolean; onChange: (values: Values, selection?: AddressSelection) => void };

export function PropertyLocationInput({ postcode, suburb, state, selection, invalid, onChange }: Props) {
  const id = useId();
  const parsed = AddressSelectionSchema.safeParse(selection);
  const selected = parsed.success && parsed.data.source === 'LOOKUP';
  const [manual, setManual] = useState(parsed.success && parsed.data.source === 'MANUAL');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    if (manual || selected || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/addresses/search', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: query.trim(), kind: 'LOCALITY' }), signal: controller.signal,
        });
        const body = await response.json() as { suggestions?: LocationSuggestion[]; error?: string };
        if (controller.signal.aborted) return;
        if (!response.ok) throw new Error('Location search is unavailable. Try again or enter your location manually.');
        setSuggestions(body.suggestions ?? []); setSearched(true); setOpen(true);
      } catch (cause) {
        if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : 'Location search is unavailable.'); setSearched(true); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, selected, manual]);

  function choose(item: LocationSuggestion) {
    onChange({ postcode: item.postcode, suburb: item.suburb, state: item.state }, item.selection);
    setQuery(''); setSuggestions([]); setOpen(false); setActive(-1); setError(''); setLoading(false);
  }

  function updateManual(values: Values) {
    onChange(values, { source: 'MANUAL', reason: parsed.success && parsed.data.source === 'MANUAL' ? parsed.data.reason : 'NOT_FOUND' });
  }

  return <div className="relative" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    {manual ? <fieldset className="grid gap-3 rounded-xl border bg-slate-50 p-4 sm:grid-cols-3"><legend className="px-1 text-sm font-semibold">Enter your property location</legend>
      <label className="text-sm font-medium">Postcode<Input className="mt-1" aria-invalid={invalid} inputMode="numeric" maxLength={4} value={postcode} onChange={event => updateManual({ postcode: event.target.value.replace(/\D/g, ''), suburb, state })} placeholder="e.g. 2000" /></label>
      <label className="text-sm font-medium">Suburb<Input className="mt-1" maxLength={100} value={suburb} onChange={event => updateManual({ postcode, suburb: event.target.value, state })} placeholder="e.g. Sydney" /></label>
      <div className="text-sm font-medium"><p id={`${id}-state-label`}>State / territory</p><Select value={state} onValueChange={next => updateManual({ postcode, suburb, state: next })}><SelectTrigger className="mt-1 h-8" aria-labelledby={`${id}-state-label`}><SelectValue placeholder="Select state" /></SelectTrigger><SelectContent>{AUSTRALIAN_STATES.map(code => <SelectItem key={code} value={code}>{code}</SelectItem>)}</SelectContent></Select></div>
    </fieldset> : <>
      <div className="relative"><Input role="combobox" aria-label="Property postcode or suburb" aria-autocomplete="list" aria-expanded={open && suggestions.length > 0}
        aria-controls={`${id}-results`} aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
        aria-describedby={`${id}-help`} aria-invalid={invalid} autoComplete="off" maxLength={200}
        placeholder="Search postcode or suburb, e.g. 2000 or Sydney" value={selected ? `${postcode} — ${suburb}, ${state}` : query}
        onFocus={() => setOpen(true)} onChange={event => {
          setQuery(event.target.value); onChange({ postcode: '', suburb: '', state: '' });
          setSuggestions([]); setSearched(false); setError(''); setActive(-1); setLoading(false); setOpen(true);
        }} onKeyDown={event => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setOpen(true);
            setActive(current => suggestions.length ? (current + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length : -1);
          }
          if (event.key === 'Enter' && !selected) {
            event.preventDefault(); if (open && active >= 0 && suggestions[active]) choose(suggestions[active]);
          }
        }} />{loading && <LoaderCircle aria-label="Searching locations" className="pointer-events-none absolute right-2 top-2 h-4 w-4 animate-spin text-slate-500" />}</div>
      {open && suggestions.length > 0 && <ul id={`${id}-results`} role="listbox" aria-label="Property location suggestions" className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">{suggestions.map((item, index) => <li key={item.id} role="presentation"><button type="button" role="option" aria-selected={active === index} id={`${id}-option-${index}`} onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(item)} className={`w-full rounded-lg px-3 py-3 text-left text-sm hover:bg-primary/5 ${active === index ? 'bg-primary/5 text-primary' : 'text-slate-700'}`}>{item.postcode} — {item.suburb}, {item.state}</button></li>)}</ul>}
    </>}
    <div id={`${id}-help`} className="mt-2 space-y-1 text-xs leading-5 text-slate-500" aria-live="polite">
      {manual ? <p>Your broker will confirm this manually entered location.</p>
        : selected ? <p className="flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Property location selected.</p>
        : error ? <p>{error}</p>
        : searched && !suggestions.length ? <p>No matching postcode and suburb found. Try the suburb name or enter your location manually.</p>
        : null}
      {!manual && searched && !loading && <button type="button" className="font-semibold text-primary underline underline-offset-2" onClick={() => {
        setManual(true); setOpen(false); setSuggestions([]); setLoading(false);
        onChange({ postcode: /^\d{4}$/.test(query.trim()) ? query.trim() : '', suburb: /\d/.test(query) ? '' : query.trim(), state: '' }, { source: 'MANUAL', reason: error ? 'UNAVAILABLE' : 'NOT_FOUND' });
        setQuery('');
      }}>Enter postcode and suburb manually</button>}
      {manual && <button type="button" className="font-semibold text-primary underline underline-offset-2" onClick={() => {
        setManual(false); setQuery(postcode || suburb); onChange({ postcode: '', suburb: '', state: '' }); setError(''); setSearched(false);
      }}>Search for my location instead</button>}
    </div>
  </div>;
}
