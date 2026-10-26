'use client';

import { useEffect, useId, useState } from 'react';
import { CheckCircle2, LoaderCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { AddressSelectionSchema, type AddressSelection, type AddressSuggestion } from '@/lib/validations/address';

type Props = {
  value: string;
  selection?: unknown;
  onChange: (address: string, selection?: AddressSelection) => void;
  label: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
};

export function AddressInput({ value, selection, onChange, label, disabled, invalid, className }: Props) {
  const id = useId();
  const parsed = AddressSelectionSchema.safeParse(selection);
  const [manual, setManual] = useState(parsed.success && parsed.data.source === 'MANUAL');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    if (manual || disabled || value || query.trim().length < 4) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/addresses/search', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: query.trim() }), signal: controller.signal,
        });
        const body = await response.json() as { suggestions?: AddressSuggestion[]; error?: string };
        if (controller.signal.aborted) return;
        if (!response.ok) throw new Error(body.error || 'Address search is unavailable.');
        setSuggestions(body.suggestions ?? []);
        setSearched(true);
        setOpen(true);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Address search is unavailable.');
          setSearched(true);
        }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, value, manual, disabled]);

  function choose(item: AddressSuggestion) {
    onChange(item.address, item.selection);
    setQuery(''); setSuggestions([]); setOpen(false); setActive(-1); setError(''); setLoading(false);
  }

  return <div className="relative" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <div className="relative">
      <Input aria-label={label} aria-invalid={invalid} disabled={disabled} className={className}
        autoComplete="off" maxLength={500} value={value || query}
        role={manual ? undefined : 'combobox'} aria-autocomplete={manual ? undefined : 'list'}
        aria-expanded={!manual && open && suggestions.length > 0} aria-controls={manual ? undefined : `${id}-results`}
        aria-describedby={`${id}-help`} aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
        placeholder={manual ? 'Street address, suburb, state and postcode' : 'Start typing your street address'}
        onFocus={() => setOpen(true)} onChange={event => {
          if (manual) {
            onChange(event.target.value, { source: 'MANUAL', reason: parsed.success && parsed.data.source === 'MANUAL' ? parsed.data.reason : 'NOT_FOUND' });
          } else {
            setQuery(event.target.value); onChange('', undefined);
            setSuggestions([]); setSearched(false); setError(''); setActive(-1); setLoading(false); setOpen(true);
          }
        }} onKeyDown={event => {
          if (manual) return;
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setOpen(true);
            setActive(current => suggestions.length ? (current + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length : -1);
          }
          if (event.key === 'Enter' && !value) {
            event.preventDefault();
            if (open && active >= 0 && suggestions[active]) choose(suggestions[active]);
          }
        }} />
      {loading && <LoaderCircle aria-label="Searching addresses" className="pointer-events-none absolute right-2 top-2 h-4 w-4 animate-spin text-slate-500" />}
    </div>
    {!manual && open && suggestions.length > 0 && <ul id={`${id}-results`} role="listbox" aria-label={`${label} suggestions`} className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
      {suggestions.map((item, index) => <li key={item.id} role="presentation"><button type="button" role="option" aria-selected={active === index} id={`${id}-option-${index}`} onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(item)} className={`w-full rounded-lg px-3 py-3 text-left text-sm hover:bg-primary/5 ${active === index ? 'bg-primary/5 text-primary' : 'text-slate-700'}`}>{item.address}</button></li>)}
    </ul>}
    <div id={`${id}-help`} className="mt-2 space-y-1 text-xs leading-5 text-slate-500" aria-live="polite">
      {manual ? <p>Include the unit number (if applicable), street, suburb, state and postcode.</p>
        : value ? <p className="flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />{parsed.success ? 'Address selected.' : 'Saved address. Search again to make changes.'}</p>
        : error ? <p>{error}</p>
        : searched && !suggestions.length ? <p>No complete addresses found. Try adding the suburb or postcode, or enter your address manually.</p>
        : null}
      {!manual && searched && !loading && <button type="button" disabled={disabled} onClick={() => {
        setManual(true); setOpen(false); setSuggestions([]); setLoading(false);
        onChange(query, { source: 'MANUAL', reason: error ? 'UNAVAILABLE' : 'NOT_FOUND' }); setQuery('');
      }} className="font-semibold text-primary underline underline-offset-2">{error ? 'Enter address manually' : "I can’t find my full address"}</button>}
      {manual && <button type="button" disabled={disabled} onClick={() => { setManual(false); setQuery(value); onChange('', undefined); setSearched(false); setError(''); }} className="font-semibold text-primary underline underline-offset-2">Search for my address instead</button>}
    </div>
  </div>;
}
