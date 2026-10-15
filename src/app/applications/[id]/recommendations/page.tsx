'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Clock3, Info, LoaderCircle, RefreshCw, X } from 'lucide-react';

type Quote = {
  id: string;
  rank: number;
  lenderName: string;
  lenderLogoUrl?: string | null;
  productName: string;
  eligibility: { status: 'ELIGIBLE' | 'REVIEW_REQUIRED' | 'INELIGIBLE'; reasons?: string[]; warnings?: string[]; explanation?: string[] };
  rate: { value: string; type: string; repaymentType: string; fixedPeriodMonths?: number | null };
  estimate: { lvr?: string | null; monthlyRepayment?: string | null };
  comparison?: { horizonMonths: number | null; netCost: string | null; effectiveMonthlyCost?: string | null; rateAssumption?: string };
  promotions?: Array<{ promotionId: string; name: string; amount: string | null; currency: string; qualification: 'QUALIFIES' | 'DOES_NOT_QUALIFY' | 'NEEDS_REVIEW'; appliedAmount: string; reasons: string[]; terms: string | null; sourceUri: string | null }>;
  features: unknown;
  constraints: unknown[];
  fees: { items: unknown[]; estimateComplete: boolean };
  sourceObservedAt: string;
};
type Result = { success: boolean; applicationId: string; applicationLvr?: string | null; recommendationStatus?: string; recommendationRunId?: string; count: number; quotes: Quote[]; error?: string };

const currency = (value?: string | null) => value ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 2 }).format(Number(value)) : 'Not available';
const pretty = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
const prettyRepayment = (value: string) => value === 'P_AND_I' ? 'Principal & interest' : value === 'INTEREST_ONLY' ? 'Interest only' : pretty(value);
const asList = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const FEATURE_LABELS: Record<string, string> = {
  OFFSET_ACCOUNT: 'Offset account',
  REDRAW: 'Redraw facility',
  LOAN_REDRAW: 'Redraw facility',
  DRAW_OUT: 'Redraw facility',
  DRAWOUT: 'Redraw facility',
  REDRAW_FACILITY: 'Redraw facility',
  EXTRA_REPAYMENTS: 'Extra repayments',
  ADDITIONAL_REPAYMENTS: 'Extra repayments',
  REPAYMENT_FREQUENCY: 'Repayment frequency',
  INTEREST_ONLY: 'Interest only',
  CASHBACK_OFFER: 'Cashback offer',
  REPAYMENT_HOLIDAY: 'Repayment holiday',
  SPLIT_LOAN: 'Split loan',
};
const CONSTRAINT_LABELS: Record<string, string> = {
  MIN_LVR: 'Minimum LVR',
  MAX_LVR: 'Maximum LVR',
  MIN_LIMIT: 'Minimum loan amount',
  MAX_LIMIT: 'Maximum loan amount',
};

type FormattedDetail = { title: string; description?: string; value?: string; sourceUri?: string };
const textValue = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const readableValue = (value: unknown): string | null => {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return new Intl.NumberFormat('en-AU').format(value);
  if (typeof value === 'string' && value.trim()) return /^[A-Z0-9_]+$/.test(value) ? pretty(value) : value.trim();
  return null;
};

function formatFeature(value: unknown): FormattedDetail {
  if (typeof value === 'string') return { title: pretty(value) };
  const item = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const featureType = textValue(item.featureType)?.toUpperCase();
  const title = textValue(item.name) ?? textValue(item.title) ?? (featureType ? FEATURE_LABELS[featureType] ?? pretty(featureType) : textValue(item.feature) ?? 'Product feature');
  const description = textValue(item.additionalInfo) ?? textValue(item.description) ?? textValue(item.details);
  const rawValue = item.additionalValue ?? item.value;
  const isCashback = featureType === 'CASHBACK_OFFER';
  const valueText = isCashback && rawValue !== null && rawValue !== undefined && Number.isFinite(Number(rawValue))
    ? currency(String(rawValue))
    : readableValue(rawValue);
  return { title, description: description ?? undefined, value: valueText ?? undefined, sourceUri: textValue(item.additionalInfoUri) ?? undefined };
}

function formatConstraint(value: unknown): FormattedDetail {
  if (typeof value === 'string') return { title: pretty(value) };
  const item = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const type = textValue(item.constraintType)?.toUpperCase();
  const title = textValue(item.name) ?? (type ? CONSTRAINT_LABELS[type] ?? pretty(type) : textValue(item.title) ?? 'Product condition');
  const rawValue = item.additionalValue ?? item.value;
  const numberValue = rawValue === null || rawValue === undefined || rawValue === '' ? Number.NaN : typeof rawValue === 'number' ? rawValue : Number(rawValue);
  const unit = textValue(item.unitOfMeasure) ?? textValue(item.unit);
  const isLvr = type?.endsWith('_LVR');
  const isAmount = type === 'MIN_LIMIT' || type === 'MAX_LIMIT';
  const normalizedNumber = Number.isFinite(numberValue) && isLvr && numberValue <= 1 ? numberValue * 100 : numberValue;
  const valueText = Number.isFinite(numberValue)
    ? isAmount ? currency(normalizedNumber.toFixed(2)) : `${new Intl.NumberFormat('en-AU', { maximumFractionDigits: 2 }).format(normalizedNumber)}${isLvr ? '%' : unit ? ` ${pretty(unit)}` : ''}`
    : readableValue(rawValue);
  return {
    title,
    description: textValue(item.additionalInfo) ?? textValue(item.description) ?? undefined,
    value: valueText || undefined,
  };
}

function DetailList({ items, kind }: { items: unknown[]; kind: 'feature' | 'constraint' }) {
  if (!items.length) return <p className="mt-2 text-sm text-slate-500">{kind === 'feature' ? 'Feature information was not supplied for this product.' : 'No parsed product conditions are available.'}</p>;
  const format = kind === 'feature' ? formatFeature : formatConstraint;
  return <ul className="mt-3 space-y-3">{items.map((item, index) => {
    const detail = format(item);
    return <li key={`${detail.title}-${index}`} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900">{detail.title}</p>{detail.value && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{detail.value}</span>}</div>
        {detail.description && <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-600">{detail.description}</p>}
        {detail.sourceUri && <a href={detail.sourceUri} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-primary underline">View source</a>}
      </div>
    </li>;
  })}</ul>;
}

function BankLogo({ lenderName, logoUrl }: { lenderName: string; logoUrl?: string | null }) {
  const [failed, setFailed] = useState(false);
  const initials = lenderName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const validUrl = logoUrl && /^https?:\/\//i.test(logoUrl);
  return <div className="relative flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-white p-1.5">
    {validUrl && !failed ? <Image src={logoUrl} alt={`${lenderName} logo`} fill sizes="64px" unoptimized className="object-contain p-1.5" onError={() => setFailed(true)} /> : <span aria-label={`${lenderName} logo unavailable`} className="text-sm font-bold tracking-wide text-primary">{initials || 'Bank'}</span>}
  </div>;
}

function QuoteDetailsDialog({ quote, onClose, continueHref }: { quote: Quote; onClose: () => void; continueHref: string }) {
  const fees = asList(quote.fees.items);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown); };
  }, [onClose]);

  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby={`quote-details-${quote.id}`} className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-slate-50 shadow-2xl sm:rounded-3xl">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-7">
        <div className="flex min-w-0 items-center gap-3"><BankLogo key={quote.lenderLogoUrl ?? quote.lenderName} lenderName={quote.lenderName} logoUrl={quote.lenderLogoUrl} /><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-primary">Product details · Option {quote.rank}</p><h2 id={`quote-details-${quote.id}`} className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{quote.lenderName}</h2><p className="mt-1 text-sm text-slate-600">{quote.productName}</p></div></div>
        <button type="button" onClick={onClose} aria-label="Close product details" className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><X className="h-5 w-5" /></button>
      </header>
      <div className="overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
        <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-white p-4"><p className="text-xs text-slate-500">Interest rate</p><p className="mt-1 text-lg font-bold tabular-nums">{Number(quote.rate.value).toFixed(2)}% p.a.</p><p className="text-xs text-slate-500">{pretty(quote.rate.type)} · {prettyRepayment(quote.rate.repaymentType)}</p></div><div className="rounded-xl bg-white p-4"><p className="text-xs text-slate-500">Monthly repayment estimate</p><p className="mt-1 text-lg font-bold tabular-nums">{currency(quote.estimate.monthlyRepayment)}</p><p className="text-xs text-slate-500">Principal and interest estimate</p></div></div>
        {quote.comparison?.netCost && <p className="mt-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-600"><span className="font-semibold text-slate-800">Estimated {quote.comparison.horizonMonths ? `${quote.comparison.horizonMonths / 12}-year net cost: ${currency(quote.comparison.netCost)}` : `net cost: ${currency(quote.comparison.netCost)}`}</span> · Current rate assumed to stay the same; fees excluded and matched cashback deducted.</p>}
        <section className="mt-6"><h3 className="text-base font-bold text-slate-900">Product features</h3><DetailList items={asList(quote.features)} kind="feature" /></section>
        <section className="mt-6"><h3 className="text-base font-bold text-slate-900">Eligibility and product conditions</h3><DetailList items={asList(quote.constraints)} kind="constraint" /></section>
        {quote.promotions?.length ? <section className="mt-6"><h3 className="text-base font-bold text-slate-900">Promotions</h3><div className="mt-3 space-y-3">{quote.promotions.map(promotion => <div key={promotion.promotionId} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-900">{promotion.name}</p><p className="font-bold text-primary">{currency(promotion.amount)}</p></div><p className="mt-2 text-sm leading-6 text-slate-600">{promotion.reasons.map(pretty).join(' · ') || promotion.terms || 'Offer terms apply.'}</p>{promotion.sourceUri && <a href={promotion.sourceUri} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-primary underline">Offer details</a>}</div>)}</div></section> : null}
        <section className="mt-6"><h3 className="text-base font-bold text-slate-900">Product fees <span className="text-sm font-normal text-slate-500">(reference only)</span></h3>{fees.length ? <ul className="mt-3 grid gap-2 sm:grid-cols-2">{fees.map((fee, index) => { const item = fee as Record<string, unknown>; return <li key={index} className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><span className="font-semibold text-slate-800">{String(item.name ?? item.type ?? 'Fee')}</span><span className="ml-2 text-slate-600">{item.amount ? currency(String(item.amount)) : 'Amount not supplied'}</span></li>; })}</ul> : <p className="mt-2 text-sm text-slate-500">No fee data is available.</p>}<p className="mt-2 text-xs leading-5 text-slate-500">Fees are shown for reference and are excluded from comparison cost and ranking.</p></section>
        <p className="mt-6 flex items-center gap-1.5 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" />Bank product data observed {new Date(quote.sourceObservedAt).toLocaleString('en-AU')}</p>
      </div>
      <footer className="flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-7"><button type="button" onClick={onClose} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Close details</button><Link href={continueHref} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90">Continue with this product</Link></footer>
    </section>
  </div>;
}

function QuoteCard({ quote, applicationId }: { quote: Quote; applicationId: string }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const reasons = [...(quote.eligibility.reasons ?? []), ...(quote.eligibility.warnings ?? [])];
  const promotions = quote.promotions ?? [];
  return <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
    <div className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3"><BankLogo key={quote.lenderLogoUrl ?? quote.lenderName} lenderName={quote.lenderName} logoUrl={quote.lenderLogoUrl} /><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-primary">Option {quote.rank}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{quote.lenderName}</h2><p className="text-sm text-slate-600">{quote.productName}</p></div></div>
        {quote.eligibility.status === 'REVIEW_REQUIRED' && <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800"><Info className="h-4 w-4" />Some conditions need review</span>}
      </div>
      <div className="mt-5 grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
        <div className="grid min-h-28 grid-rows-[2.75rem_2.5rem_1.25rem]"><p className="text-sm leading-5 text-slate-500">Estimated monthly repayment</p><p className="text-2xl font-bold leading-9 tabular-nums text-slate-900">{currency(quote.estimate.monthlyRepayment)}</p><p className="text-xs text-slate-500">Principal and interest estimate</p></div>
        <div className="grid min-h-28 grid-rows-[2.75rem_2.5rem_1.25rem]"><p className="text-sm leading-5 text-slate-500">Interest rate</p><p className="text-2xl font-bold leading-9 tabular-nums text-slate-900">{Number(quote.rate.value).toFixed(2)}% p.a.</p><p className="text-xs text-slate-500">{pretty(quote.rate.type)}{quote.rate.fixedPeriodMonths ? ` · ${quote.rate.fixedPeriodMonths / 12} year fixed` : ' · Current variable rate'}</p></div>
      </div>
      {reasons.length > 0 && <p className="mt-4 flex items-start gap-2 text-sm text-amber-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{pretty(reasons[0])}</p>}
      {promotions.length > 0 && <div className="mt-4 space-y-2">{promotions.map(promotion => { const assumed = promotion.reasons.some(reason => reason.includes('_ASSUMED_')); return <p key={promotion.promotionId} className={`rounded-lg px-3 py-2 text-sm ${promotion.qualification === 'QUALIFIES' ? 'bg-emerald-50 text-emerald-800' : promotion.qualification === 'NEEDS_REVIEW' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
        <span className="font-semibold">{promotion.name} · {currency(promotion.amount)}</span>{' — '}{promotion.qualification === 'QUALIFIES' ? assumed ? 'Included in comparison using preliminary timing assumptions; final eligibility is subject to lender assessment.' : 'Eligibility matched; included in comparison cost.' : promotion.qualification === 'NEEDS_REVIEW' ? 'Eligibility needs confirmation; not included in comparison cost.' : 'Eligibility conditions are not met.'}
      </p>; })}</div>}
      <button type="button" aria-haspopup="dialog" onClick={() => setDetailsOpen(true)} className="mt-5 flex w-full items-center justify-center gap-2 border-t border-slate-100 pt-4 text-sm font-bold text-primary hover:text-primary/80">
        View product details <Info className="h-4 w-4" />
      </button>
      <Link href={`/applications/${applicationId}/continue?quote=${quote.id}`} className="flex w-full items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary/90">Continue with this product</Link>
    </div>
    {detailsOpen && <QuoteDetailsDialog quote={quote} onClose={() => setDetailsOpen(false)} continueHref={`/applications/${applicationId}/continue?quote=${quote.id}`} />}
  </article>;
}

export default function ApplicationRecommendationsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/application/${id}/recommend`, { cache: 'no-store' });
        const body = await response.json() as Result;
        if (response.status === 401) { router.replace(`/login?next=${encodeURIComponent(`/applications/${id}/recommendations`)}`); return; }
        if (!response.ok) throw new Error(body.error || 'Could not load recommendations.');
        if (active) setResult(body);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load recommendations.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id, router]);

  const recalculate = async () => {
    setRefreshing(true); setError('');
    try { const response = await fetch(`/api/application/${id}/recommend`, { method: 'POST' }); const body = await response.json() as Result; if (response.status === 401) { router.replace(`/login?next=${encodeURIComponent(`/applications/${id}/recommendations`)}`); return; } if (!response.ok) throw new Error(body.error || 'Could not refresh recommendations.'); setResult(body); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not refresh recommendations.'); }
    finally { setRefreshing(false); }
  };

  const waiting = result?.recommendationStatus === 'PENDING' || result?.recommendationStatus === 'RUNNING' || result?.recommendationStatus === 'FAILED';
  return <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8"><div className="mx-auto max-w-6xl">
    <div className="mx-auto max-w-3xl text-center"><p className="text-sm font-bold uppercase tracking-widest text-primary">Your home loan matches</p><h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Options based on your application</h1><p className="mt-4 text-slate-600">Compare estimated repayments, rates and product features. These are preliminary matches; lender policy and final approval need to be confirmed.</p></div>
    {error && <div role="alert" className="mx-auto mt-8 flex max-w-3xl items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}
    {loading ? <div className="flex justify-center py-20 text-slate-500"><LoaderCircle className="mr-2 h-5 w-5 animate-spin" />Loading your matches…</div> : waiting ? <section className="mx-auto mt-10 max-w-2xl rounded-2xl border bg-white p-8 text-center shadow-sm"><Clock3 className="mx-auto h-9 w-9 text-primary"/><h2 className="mt-4 text-xl font-bold">Your application is saved</h2><p className="mt-2 text-slate-600">Recommendations are not ready yet. Try again to run the matching process.</p><button onClick={recalculate} disabled={refreshing} className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-white disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />{refreshing ? 'Checking…' : 'Get recommendations'}</button></section> : result && result.quotes.length ? <><div className="mt-9 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-800">Top {result.count} preliminary matches</p><p className="mt-1 text-sm text-slate-600">Ranked by known eligibility and estimated comparison cost.{result.applicationLvr && <> Application LVR: <span className="font-semibold tabular-nums">{Number(result.applicationLvr).toFixed(1)}%</span>.</>}</p></div><button onClick={recalculate} disabled={refreshing} className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-primary/50 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Refresh matches</button></div><div className="mt-4 grid gap-5 lg:grid-cols-2">{result.quotes.map(quote => <QuoteCard key={quote.id} quote={quote} applicationId={id}/>)}</div></> : <section className="mx-auto mt-10 max-w-2xl rounded-2xl border bg-white p-8 text-center"><h2 className="text-xl font-bold">No matches yet</h2><p className="mt-2 text-slate-600">We could not find a current match for this application. You can retry after product data is updated.</p><button onClick={recalculate} disabled={refreshing} className="mt-5 rounded-full bg-primary px-5 py-3 font-semibold text-white">{refreshing ? 'Checking…' : 'Retry recommendations'}</button></section>}
    <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-5 text-slate-500">The monthly repayment is an estimate and does not subtract cashback. The 5-year comparison cost estimates interest using today&apos;s quoted rate held constant over the comparison period, excludes all product fees, and subtracts cashback when the configured conditions match. For preliminary comparison, the application date is assumed to be today; when settlement or drawdown timing is not provided, it is assumed to meet the offer limit. Cashback eligibility, payment and final loan approval are determined by the lender under its current policy and offer terms.</p>
  </div></main>;
}
