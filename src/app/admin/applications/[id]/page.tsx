'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Check, Clock3, LoaderCircle, X } from 'lucide-react';

type Review = { id: string; decision: 'APPROVED' | 'REJECTED'; note: string | null; createdAt: string; reviewer: { fullName: string | null; email: string } };
type Quote = {
  id: string; rank: number; lenderName: string; lenderLogoUrl: string | null; productName: string;
  quotedRate: string; quotedRateType: string; quotedRepayment: string; annualFee: string | null;
  calculatedLvr: string | null; monthlyRepayment: string | null; score: string | null;
  eligibilityStatus: string; comparisonCost: string | null; comparisonHorizonMonths: number | null;
  explanation: unknown; productSnapshot: unknown; rateSnapshot: unknown; promotionSnapshot: unknown;
  createdAt: string; reviews: Review[];
};
type Application = Record<string, unknown> & {
  id: string; goal: string; currentStage: string; createdAt: string;
  user: { id: string; fullName: string | null; email: string; phone: string | null; createdAt: string };
  recommendation: { id: string; status: string; rulesVersion: string; createdAt: string; quotes: Quote[] } | null;
};
type ApiResponse = { application?: Application; error?: string };

const humanize = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
const currency = (value: unknown) => value === null || value === undefined ? 'Not available' : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 2 }).format(Number(value));
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
function describeSnapshotItem(value: unknown): string {
  if (typeof value === 'string') return humanize(value);
  const item = record(value);
  const title = item.constraintType ?? item.featureType ?? item.name ?? item.title ?? item.type ?? 'Product condition';
  const detail = item.description ?? item.additionalInfo ?? item.rawText ?? item.text;
  const numeric = item.numericValue ?? item.value ?? item.additionalValue;
  const pieces = [humanize(String(title))];
  if (numeric !== undefined && numeric !== null && String(numeric).trim()) pieces.push(String(numeric));
  if (typeof detail === 'string' && detail.trim()) pieces.push(detail.trim());
  return pieces.join(' · ');
}

const APPLICATION_FIELDS: Array<[string, string, ((value: unknown) => string)?]> = [
  ['goal', 'Application goal'], ['buySituation', 'Buying timeframe'], ['isFirstHomeBuyer', 'First home buyer'], ['propertyUse', 'Property use'], ['propertyStatus', 'Property status'], ['propertyType', 'Property type'], ['propertyPostcode', 'Property postcode'], ['purchasePrice', 'Purchase price', currency], ['deposit', 'Deposit', currency],
  ['refinanceGoal', 'Refinance goal'], ['cashOutPurpose', 'Cash out purpose'], ['propertyAddress', 'Property address'], ['currentLender', 'Current lender'], ['propertyValue', 'Property value', currency], ['currentLoanBalance', 'Current loan balance', currency], ['currentInterestRate', 'Current interest rate', value => `${value}%`], ['currentRepaymentType', 'Current repayment type'], ['isFixedRate', 'Currently fixed rate'], ['fixedRateExpiry', 'Fixed rate expiry'],
  ['repaymentStructure', 'Requested repayment'], ['interestOnlyYears', 'Interest only period'], ['ratePreference', 'Rate preference'], ['fixedYears', 'Requested fixed period'], ['employmentStatus', 'Employment status'], ['employmentStartDate', 'Employment start date'], ['grossAnnualSalary', 'Gross annual salary', currency], ['relationshipStatus', 'Relationship status'], ['partnerEmploymentStatus', 'Partner employment status'], ['partnerEmploymentStartDate', 'Partner employment start date'], ['partnerGrossSalary', 'Partner gross salary', currency], ['dependents', 'Dependents'], ['hasExistingLoans', 'Existing loans'], ['existingMonthlyRepayment', 'Existing monthly repayment', currency], ['hasCreditCard', 'Credit card'], ['creditCardLimit', 'Credit card limit', currency], ['currentStage', 'Application stage'],
];

function display(value: unknown) {
  if (value === null || value === undefined || value === '') return 'Not provided';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return typeof value === 'string' ? humanize(value) : String(value);
}

export default function AdminApplicationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingQuote, setSavingQuote] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const fetchApplication = useCallback(async () => {
    const response = await fetch(`/api/admin/applications/${id}`, { cache: 'no-store' });
    const body = await response.json() as ApiResponse;
    if (response.status === 401) { router.replace(`/login?next=${encodeURIComponent(`/admin/applications/${id}`)}`); return null; }
    if (!response.ok || !body.application) throw new Error(body.error || 'Could not load application.');
    return body.application;
  }, [id, router]);

  const load = useCallback(async () => {
    try {
      const data = await fetchApplication();
      if (data) { setError(''); setApplication(data); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load application.');
    } finally { setLoading(false); }
  }, [fetchApplication]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const data = await fetchApplication();
        if (active && data) { setError(''); setApplication(data); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load application.');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [fetchApplication]);

  const review = async (quoteId: string, decision: 'APPROVED' | 'REJECTED') => {
    setSavingQuote(quoteId); setError('');
    try {
      const response = await fetch(`/api/admin/applications/${id}/quotes/${quoteId}/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note: notes[quoteId] || null }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || 'Could not save review.');
      setNotes(current => ({ ...current, [quoteId]: '' }));
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save review.'); }
    finally { setSavingQuote(null); }
  };

  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <Link href="/admin/users" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-primary"><ArrowLeft className="h-4 w-4" />Back to users</Link>
    {loading && <div className="flex justify-center py-20 text-slate-500"><LoaderCircle className="mr-2 h-5 w-5 animate-spin" />Loading application…</div>}
    {error && <div role="alert" className="mt-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}
    {application && <>
      <header className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">Application review</p><h1 className="mt-2 text-2xl font-extrabold text-slate-900">{application.goal === 'BUY' ? 'Home purchase' : 'Refinance'}{application.propertyPostcode ? ` · ${application.propertyPostcode}` : ''}</h1><p className="mt-2 text-sm text-slate-600">Application {application.id}</p></div><span className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">{humanize(application.currentStage)}</span></div>
        <div className="mt-6 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3"><div><p className="text-xs text-slate-500">Applicant</p><p className="mt-1 font-semibold text-slate-900">{application.user.fullName || 'Name not provided'}</p></div><div><p className="text-xs text-slate-500">Email and phone</p><p className="mt-1 break-all font-semibold text-slate-900">{application.user.email}</p><p className="text-sm text-slate-600">{application.user.phone || 'Phone not provided'}</p></div><div><p className="text-xs text-slate-500">Submitted</p><p className="mt-1 font-semibold text-slate-900">{new Date(application.createdAt).toLocaleString('en-AU')}</p></div></div>
      </header>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-bold text-slate-900">Questionnaire details</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{APPLICATION_FIELDS.map(([key, title, format]) => <div key={key} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-medium text-slate-500">{title}</p><p className="mt-1 break-words text-sm font-semibold text-slate-900">{format && application[key] !== null && application[key] !== undefined ? format(application[key]) : display(application[key])}</p></div>)}</div>
      </section>

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">Match review</p><h2 className="mt-1 text-2xl font-extrabold text-slate-900">Recommendation results</h2></div>{application.recommendation && <p className="text-sm text-slate-500">{application.recommendation.rulesVersion} · {new Date(application.recommendation.createdAt).toLocaleString('en-AU')}</p>}</div>
        {!application.recommendation && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">No recommendation run is available for this application yet.</div>}
        {application.recommendation && <div className="mt-4 space-y-4">{application.recommendation.quotes.length === 0 && <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">This recommendation run did not produce any matches.</div>}{application.recommendation.quotes.map(quote => {
          const latest = quote.reviews[0];
          const explanation = record(quote.explanation);
          const eligibility = record(explanation.eligibility);
          const highlights = array(explanation.highlights).filter((item): item is string => typeof item === 'string');
          const reasons = [...array(eligibility.reasons), ...array(eligibility.warnings)].filter((item): item is string => typeof item === 'string');
          const promotions = array(quote.promotionSnapshot).map(record);
          const productSnapshot = record(quote.productSnapshot);
          const rateSnapshot = record(quote.rateSnapshot);
          const productConditions = [...array(productSnapshot.features), ...array(productSnapshot.constraints), ...array(rateSnapshot.conditions)].map(describeSnapshotItem).filter(Boolean);
          return <article key={quote.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Rank #{quote.rank} · {quote.lenderName}</p><h3 className="mt-1 text-xl font-bold text-slate-900">{quote.productName}</h3><p className="mt-1 text-sm text-slate-500">Automatic eligibility: {humanize(quote.eligibilityStatus)}</p></div><div className="rounded-xl bg-slate-50 px-4 py-3 text-right"><p className="text-xs text-slate-500">Rate</p><p className="text-xl font-bold tabular-nums text-slate-900">{quote.quotedRate}%</p><p className="text-xs text-slate-500">{humanize(quote.quotedRateType)} · {humanize(quote.quotedRepayment)}</p></div></div>
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4 sm:p-6"><Metric label="Monthly repayment" value={currency(quote.monthlyRepayment)} /><Metric label="LVR" value={quote.calculatedLvr ? `${quote.calculatedLvr}%` : 'Not available'} /><Metric label="Comparison cost" value={currency(quote.comparisonCost)} /><Metric label="Comparison period" value={quote.comparisonHorizonMonths ? `${quote.comparisonHorizonMonths} months` : 'Not available'} /></div>
            <div className="grid gap-5 border-t border-slate-100 p-5 lg:grid-cols-2 sm:p-6"><div><h4 className="font-semibold text-slate-900">Why it matched</h4>{highlights.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">{highlights.map((item, index) => <li key={`${index}-${item}`}>{humanize(item)}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No explanation recorded.</p>}{reasons.length > 0 && <><h4 className="mt-4 font-semibold text-slate-900">Eligibility points to review</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">{reasons.map((item, index) => <li key={`${index}-${item}`}>{humanize(item)}</li>)}</ul></>}</div>
              <div><h4 className="font-semibold text-slate-900">Promotions considered</h4>{promotions.length ? <div className="mt-2 space-y-2">{promotions.map((promotion, index) => <div key={String(promotion.promotionId ?? index)} className="rounded-xl border border-slate-200 p-3"><div className="flex justify-between gap-3"><p className="text-sm font-semibold text-slate-800">{String(promotion.name ?? 'Promotion')}</p><p className="shrink-0 text-sm font-bold text-primary">{currency(promotion.amount === null || promotion.amount === undefined ? null : String(promotion.amount))}</p></div><p className="mt-1 text-xs text-slate-600">{humanize(String(promotion.qualification ?? 'unknown'))}{promotion.appliedAmount !== undefined ? ` · Applied ${currency(String(promotion.appliedAmount))}` : ''}</p>{array(promotion.reasons).length > 0 && <p className="mt-1 text-xs text-slate-500">{array(promotion.reasons).map(reason => humanize(String(reason))).join(' · ')}</p>}</div>)}</div> : <p className="mt-2 text-sm text-slate-500">No promotion applied.</p>}</div>
            </div>
            <div className="border-t border-slate-100 px-5 py-4 sm:px-6"><h4 className="font-semibold text-slate-900">Product and rate conditions used</h4>{productConditions.length ? <ul className="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">{productConditions.map((condition, index) => <li key={`${index}-${condition}`} className="rounded-lg bg-slate-50 p-3">{condition}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No parsed product or rate conditions were saved in this match snapshot.</p>}</div>
            <div className="border-t border-slate-100 bg-slate-50/70 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-bold text-slate-900">Admin decision</h4>{latest && <span className={`rounded-full px-3 py-1 text-xs font-bold ${latest.decision === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{humanize(latest.decision)} · {latest.reviewer.fullName || latest.reviewer.email}</span>}</div>
              {latest?.note && <p className="mt-2 text-sm text-slate-600">Latest note: {latest.note}</p>}
              {quote.reviews.length > 1 && <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-slate-600">Review history ({quote.reviews.length})</summary><ul className="mt-2 space-y-2">{quote.reviews.slice(1).map(reviewItem => <li key={reviewItem.id} className="text-xs text-slate-600">{humanize(reviewItem.decision)} · {reviewItem.reviewer.fullName || reviewItem.reviewer.email} · {new Date(reviewItem.createdAt).toLocaleString('en-AU')}{reviewItem.note ? ` — ${reviewItem.note}` : ''}</li>)}</ul></details>}
              <label className="mt-4 block"><span className="text-xs font-semibold text-slate-600">Review note (optional)</span><textarea value={notes[quote.id] ?? ''} onChange={event => setNotes(current => ({ ...current, [quote.id]: event.target.value }))} maxLength={2000} rows={2} placeholder="Record the reason for your decision" className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>
              <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={savingQuote === quote.id} onClick={() => void review(quote.id, 'APPROVED')} className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"><Check className="h-4 w-4" />Approve match</button><button type="button" disabled={savingQuote === quote.id} onClick={() => void review(quote.id, 'REJECTED')} className="inline-flex items-center gap-2 rounded-full border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><X className="h-4 w-4" />Reject match</button>{savingQuote === quote.id && <span className="inline-flex items-center gap-2 text-sm text-slate-500"><Clock3 className="h-4 w-4 animate-pulse" />Saving…</span>}</div>
            </div>
          </article>;
        })}</div>}
      </section>
    </>}
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-bold tabular-nums text-slate-900">{value}</p></div>;
}
