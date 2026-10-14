'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Clock3, Info, LoaderCircle, RefreshCw } from 'lucide-react';

type Quote = {
  id: string;
  rank: number;
  lenderName: string;
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
type Result = { success: boolean; applicationId: string; recommendationStatus?: string; recommendationRunId?: string; count: number; quotes: Quote[]; error?: string };

const currency = (value?: string | null) => value ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 2 }).format(Number(value)) : 'Not available';
const pretty = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
const asList = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const labelOf = (value: unknown): string => {
  if (typeof value === 'string') return pretty(value);
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return String(object.name ?? object.feature ?? object.description ?? object.title ?? JSON.stringify(object));
  }
  return String(value);
};

function QuoteCard({ quote }: { quote: Quote }) {
  const [expanded, setExpanded] = useState(false);
  const eligible = quote.eligibility.status === 'ELIGIBLE';
  const features = asList(quote.features);
  const reasons = [...(quote.eligibility.reasons ?? []), ...(quote.eligibility.warnings ?? [])];
  const promotions = quote.promotions ?? [];
  return <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
    <div className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wider text-primary">Match {quote.rank}</p><h2 className="mt-1 text-xl font-bold text-slate-900">{quote.lenderName}</h2><p className="text-sm text-slate-600">{quote.productName}</p></div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${eligible ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
          {eligible ? <CheckCircle2 className="h-4 w-4" /> : <Info className="h-4 w-4" />}{eligible ? 'Meets known criteria' : 'Needs a closer look'}
        </span>
      </div>
      <div className="mt-5 grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <div><p className="text-xs text-slate-500">Estimated monthly repayment</p><p className="mt-1 text-xl font-bold text-slate-900">{currency(quote.estimate.monthlyRepayment)}</p><p className="text-xs text-slate-500">Principal and interest estimate</p></div>
        <div><p className="text-xs text-slate-500">Interest rate</p><p className="mt-1 text-xl font-bold text-slate-900">{Number(quote.rate.value).toFixed(2)}% p.a.</p><p className="text-xs text-slate-500">{pretty(quote.rate.type)}{quote.rate.fixedPeriodMonths ? ` · ${quote.rate.fixedPeriodMonths / 12} year fixed` : ''}</p></div>
        <div><p className="text-xs text-slate-500">Estimated LVR</p><p className="mt-1 text-xl font-bold text-slate-900">{quote.estimate.lvr ? `${Number(quote.estimate.lvr).toFixed(2)}%` : '—'}</p><p className="text-xs text-slate-500">{features.length} listed product features</p></div>
        <div><p className="text-xs text-slate-500">{quote.comparison?.horizonMonths ? `${quote.comparison.horizonMonths / 12}-year comparison cost` : 'Comparison cost'}</p><p className="mt-1 text-xl font-bold text-slate-900">{currency(quote.comparison?.netCost)}</p><p className="text-xs text-slate-500">Used to rank matches</p></div>
      </div>
      {reasons.length > 0 && <p className="mt-4 flex items-start gap-2 text-sm text-amber-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{pretty(reasons[0])}</p>}
      {promotions.length > 0 && <div className="mt-4 space-y-2">{promotions.map(promotion => { const assumed = promotion.reasons.some(reason => reason.includes('_ASSUMED_')); return <p key={promotion.promotionId} className={`rounded-lg px-3 py-2 text-sm ${promotion.qualification === 'QUALIFIES' ? 'bg-emerald-50 text-emerald-800' : promotion.qualification === 'NEEDS_REVIEW' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
        <span className="font-semibold">{promotion.name} · {currency(promotion.amount)}</span>{' — '}{promotion.qualification === 'QUALIFIES' ? assumed ? 'Included in comparison using preliminary timing assumptions; final eligibility is subject to lender assessment.' : 'Eligibility matched; included in comparison cost.' : promotion.qualification === 'NEEDS_REVIEW' ? 'Eligibility needs confirmation; not included in comparison cost.' : 'Eligibility conditions are not met.'}
      </p>; })}</div>}
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="mt-5 flex w-full items-center justify-center gap-2 border-t border-slate-100 pt-4 text-sm font-bold text-primary hover:text-primary/80">
        {expanded ? 'Hide product details' : 'View product details'}{expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
    </div>
    {expanded && <div className="border-t bg-slate-50/70 px-5 py-5 sm:px-6">
      <div className="grid gap-6 md:grid-cols-2">
        <section><h3 className="font-bold text-slate-900">Product features</h3>{features.length ? <ul className="mt-2 space-y-2 text-sm text-slate-700">{features.map((feature, index) => <li key={index} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{labelOf(feature)}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">Feature information was not supplied for this product.</p>}</section>
        <section><h3 className="font-bold text-slate-900">Eligibility and product conditions</h3>{quote.constraints.length ? <ul className="mt-2 space-y-2 text-sm text-slate-700">{quote.constraints.map((rule, index) => <li key={index} className="rounded-lg border bg-white p-3">{labelOf(rule)}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No parsed product conditions are available.</p>}</section>
        <section className="md:col-span-2"><h3 className="font-bold text-slate-900">Fees (reference only)</h3>{quote.fees.items.length ? <ul className="mt-2 grid gap-2 sm:grid-cols-2">{quote.fees.items.map((fee, index) => { const item = fee as Record<string, unknown>; return <li key={index} className="rounded-lg border bg-white p-3 text-sm"><span className="font-semibold text-slate-800">{String(item.name ?? item.type ?? 'Fee')}</span><span className="ml-2 text-slate-600">{item.amount ? currency(String(item.amount)) : 'Amount not supplied'}</span></li>; })}</ul> : <p className="mt-2 text-sm text-slate-500">No fee data is available.</p>}<p className="mt-2 text-xs text-slate-500">Product fees are displayed for reference and are excluded from the comparison cost and ranking.</p></section>
      </div>
      <p className="mt-5 flex items-center gap-1.5 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" />Bank product data observed {new Date(quote.sourceObservedAt).toLocaleString('en-AU')}</p>
    </div>}
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
    {loading ? <div className="flex justify-center py-20 text-slate-500"><LoaderCircle className="mr-2 h-5 w-5 animate-spin" />Loading your matches…</div> : waiting ? <section className="mx-auto mt-10 max-w-2xl rounded-2xl border bg-white p-8 text-center shadow-sm"><Clock3 className="mx-auto h-9 w-9 text-primary"/><h2 className="mt-4 text-xl font-bold">Your application is saved</h2><p className="mt-2 text-slate-600">Recommendations are not ready yet. Try again to run the matching process.</p><button onClick={recalculate} disabled={refreshing} className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-white disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />{refreshing ? 'Checking…' : 'Get recommendations'}</button></section> : result && result.quotes.length ? <><div className="mt-9 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">{result.count} preliminary matches · Ranked by eligibility and 5-year comparison cost</p><button onClick={recalculate} disabled={refreshing} className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-primary/50 disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Refresh matches</button></div><div className="mt-4 grid gap-5 lg:grid-cols-2">{result.quotes.map(quote => <QuoteCard key={quote.id} quote={quote}/>)}</div></> : <section className="mx-auto mt-10 max-w-2xl rounded-2xl border bg-white p-8 text-center"><h2 className="text-xl font-bold">No matches yet</h2><p className="mt-2 text-slate-600">We could not find a current match for this application. You can retry after product data is updated.</p><button onClick={recalculate} disabled={refreshing} className="mt-5 rounded-full bg-primary px-5 py-3 font-semibold text-white">{refreshing ? 'Checking…' : 'Retry recommendations'}</button></section>}
    <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-5 text-slate-500">The monthly repayment is an estimate and does not subtract cashback. The 5-year comparison cost estimates interest using today&apos;s quoted rate held constant over the comparison period, excludes all product fees, and subtracts cashback when the configured conditions match. For preliminary comparison, the application date is assumed to be today; when settlement or drawdown timing is not provided, it is assumed to meet the offer limit. Cashback eligibility, payment and final loan approval are determined by the lender under its current policy and offer terms.</p>
  </div></main>;
}
