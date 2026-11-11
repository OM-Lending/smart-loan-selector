'use client';

import Link from 'next/link';
import { CONSENT_STATEMENTS, type ConsentFlag } from '@/lib/legal/consent';

export function ConsentCheckbox({ purpose, checked, onChange, disabled = false, error }: { purpose: ConsentFlag; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; error?: string }) {
  return <div><label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-700"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} disabled={disabled} aria-required="true" aria-invalid={Boolean(error)} className="mt-1 h-4 w-4 shrink-0 accent-primary"/><span>{CONSENT_STATEMENTS[purpose]}</span></label><div className="ml-7 mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-primary"><Link href="/terms" target="_blank" rel="noopener noreferrer" className="underline">Terms of Use</Link><Link href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</Link><Link href="/collection-notice" target="_blank" rel="noopener noreferrer" className="underline">Collection Notice</Link></div>{error && <p role="alert" className="ml-7 mt-1 text-sm text-red-600">{error}</p>}</div>;
}
