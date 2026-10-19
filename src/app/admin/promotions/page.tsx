'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, ExternalLink, LoaderCircle, Megaphone, Pencil, RefreshCw, X } from 'lucide-react';

type Product = { productName: string; externalId: string; lender: { name: string } };
type Feature = Record<string, unknown>;
type Promotion = {
  id: string; sourceSnapshotId: string; version: number; name: string; amount: string | null; currency: string;
  requiredGoal: string | null; minimumLoanAmount: string | null; maximumLoanAmount: string | null; firstHomeBuyerOnly: boolean;
  applicationWindowStart: string | null; applicationWindowEnd: string | null; settlementWithinDays: number | null; drawdownWithinDays: number | null;
  terms: string | null; validFrom: string | null; validUntil: string | null; status: string;
  sourceSnapshot: { id: string; sourceFeature: Feature; sourceKey: string; lastObservedAt: string; product: Product };
  product: Product | null;
};
type SourceRevision = {
  id: string; changeType: string; sourceFeature: Feature; suggestedAmount: string | null; amountParseStatus: string;
  lastObservedAt: string; sourceKey: string; product: Product; promotions: Promotion[];
  previousSource?: { sourceFeature: Feature; lastObservedAt: string } | null;
};
type FormValue = {
  name: string; amount: string; requiredGoal: string; minimumLoanAmount: string; maximumLoanAmount: string;
  firstHomeBuyerOnly: boolean; applicationWindowStart: string; applicationWindowEnd: string;
  settlementWithinDays: string; drawdownWithinDays: string; validFrom: string; validUntil: string; terms: string;
};
type Data = { reviewQueue: SourceRevision[]; publishedPromotions: Promotion[] };

async function loadPromotions(): Promise<Data> {
  const response = await fetch('/api/admin/promotions', { cache: 'no-store' });
  const body = await response.json() as Data & { error?: string };
  if (!response.ok) throw new Error(body.error || 'Could not load cashback offers.');
  return body;
}

const emptyForm = (snapshot: SourceRevision, promotion?: Promotion): FormValue => {
  const feature = snapshot.sourceFeature;
  const stringValue = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  const dateValue = (value: string | null | undefined) => value ? value.slice(0, 10) : '';
  return {
    name: promotion?.name ?? (stringValue(feature.name) || `${snapshot.product.lender.name} cashback offer`),
    amount: promotion?.amount ?? snapshot.suggestedAmount ?? '',
    requiredGoal: promotion?.requiredGoal ?? '',
    minimumLoanAmount: promotion?.minimumLoanAmount ?? '',
    maximumLoanAmount: promotion?.maximumLoanAmount ?? '',
    firstHomeBuyerOnly: promotion?.firstHomeBuyerOnly ?? false,
    applicationWindowStart: dateValue(promotion?.applicationWindowStart),
    applicationWindowEnd: dateValue(promotion?.applicationWindowEnd),
    settlementWithinDays: promotion?.settlementWithinDays === null || promotion?.settlementWithinDays === undefined ? '' : String(promotion.settlementWithinDays),
    drawdownWithinDays: promotion?.drawdownWithinDays === null || promotion?.drawdownWithinDays === undefined ? '' : String(promotion.drawdownWithinDays),
    validFrom: dateValue(promotion?.validFrom),
    validUntil: dateValue(promotion?.validUntil),
    terms: promotion?.terms ?? stringValue(feature.additionalInfo),
  };
};

const humanize = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
const dateLabel = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
const money = (value: string | null | undefined) => value ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Number(value)) : 'Not set';

export default function AdminPromotionsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<'review' | 'published'>('review');
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const reload = useCallback(async () => {
    try {
      setData(await loadPromotions());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load cashback offers.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    loadPromotions().then(body => { if (active) setData(body); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load cashback offers.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const review = async (snapshot: SourceRevision, action: 'PUBLISH' | 'IGNORE', values?: FormValue) => {
    setBusyId(snapshot.id); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/promotions/${snapshot.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'IGNORE' ? { action } : { ...values, action }),
      });
      const body = await response.json() as { error?: string; version?: number };
      if (!response.ok) throw new Error(body.error || 'Could not save cashback review.');
      setNotice(action === 'IGNORE' ? 'This source update was marked as not applicable.' : `Cashback offer published${body.version ? ` as version ${body.version}` : ''}.`);
      setEditing(null);
      await reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save cashback review.'); }
    finally { setBusyId(''); }
  };

  const snapshotForPromotion = (promotion: Promotion): SourceRevision => ({
    id: promotion.sourceSnapshot.id, changeType: 'UPDATED', sourceFeature: promotion.sourceSnapshot.sourceFeature,
    suggestedAmount: promotion.amount, amountParseStatus: 'PARSED', lastObservedAt: promotion.sourceSnapshot.lastObservedAt,
    sourceKey: promotion.sourceSnapshot.sourceKey, product: promotion.product ?? promotion.sourceSnapshot.product, promotions: [promotion],
  });

  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft className="h-4 w-4" />Admin dashboard</Link>
    <div className="mt-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-widest text-primary">Promotion operations</p><h1 className="mt-2 text-3xl font-extrabold text-slate-900">Cashback offers</h1><p className="mt-2 max-w-3xl text-slate-600">Review bank source changes, maintain the structured eligibility conditions, and publish the offer that will be used in future recommendations.</p></div><button type="button" onClick={() => { setLoading(true); setError(''); void reload(); }} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-primary/40 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button></div>

    {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}

    <div role="tablist" aria-label="Cashback offer views" className="mt-7 flex gap-2 border-b border-slate-200">
      <button type="button" role="tab" aria-selected={tab === 'review'} onClick={() => setTab('review')} className={`border-b-2 px-4 py-3 text-sm font-semibold ${tab === 'review' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Needs review <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{data?.reviewQueue.length ?? '—'}</span></button>
      <button type="button" role="tab" aria-selected={tab === 'published'} onClick={() => setTab('published')} className={`border-b-2 px-4 py-3 text-sm font-semibold ${tab === 'published' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Current published offers <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">{data?.publishedPromotions.length ?? '—'}</span></button>
    </div>

    {loading && !data ? <div className="flex justify-center py-16 text-slate-500"><LoaderCircle className="mr-2 h-5 w-5 animate-spin" />Loading cashback offers…</div> : tab === 'review' ? <section className="mt-5 space-y-5" aria-label="Cashback changes awaiting review">
      {!data?.reviewQueue.length && <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><CheckCircle2 className="mx-auto h-9 w-9 text-emerald-600"/><h2 className="mt-3 text-lg font-bold text-slate-900">Nothing to review</h2><p className="mt-1 text-sm text-slate-600">New or changed bank offers will appear here after a product sync.</p></div>}
      {data?.reviewQueue.map(snapshot => <article key={snapshot.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${snapshot.changeType === 'UPDATED' ? 'bg-amber-100 text-amber-900' : snapshot.changeType === 'REMOVED' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{humanize(snapshot.changeType)}</span><span className="text-xs text-slate-500">Observed {dateLabel(snapshot.lastObservedAt)}</span></div><h2 className="mt-2 text-lg font-bold text-slate-900">{snapshot.product.lender.name} · {snapshot.product.productName}</h2><p className="mt-1 text-xs text-slate-500">CDR product ID: {snapshot.product.externalId}</p></div><Megaphone className="h-6 w-6 text-amber-700"/></div>
        <SourceContent feature={snapshot.sourceFeature}/>
        {snapshot.previousSource && <details className="mt-3 rounded-xl border border-amber-200 bg-amber-50/50"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-amber-900">Compare previous bank source · observed {dateLabel(snapshot.previousSource.lastObservedAt)}</summary><div className="border-t border-amber-200 p-4"><SourceContent feature={snapshot.previousSource.sourceFeature}/></div></details>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><p className="text-sm text-slate-600">Detected amount: <span className="font-semibold text-slate-900">{money(snapshot.suggestedAmount)}</span>{snapshot.amountParseStatus !== 'PARSED' && <span className="ml-2 text-amber-800">Needs manual entry</span>}</p><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void review(snapshot, 'IGNORE')} disabled={busyId === snapshot.id} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{busyId === snapshot.id ? 'Saving…' : 'Not an offer'}</button>{snapshot.changeType !== 'REMOVED' && <button type="button" onClick={() => setEditing(editing === snapshot.id ? null : snapshot.id)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"><Pencil className="h-4 w-4"/>{editing === snapshot.id ? 'Close editor' : 'Review and publish'}</button>}</div></div>
        {editing === snapshot.id && <PromotionEditor key={`${snapshot.id}-${snapshot.promotions[0]?.id ?? 'new'}`} snapshot={snapshot} initial={emptyForm(snapshot, snapshot.promotions[0])} busy={busyId === snapshot.id} onCancel={() => setEditing(null)} onPublish={values => void review(snapshot, 'PUBLISH', values)}/>}
      </article>)}
    </section> : <section className="mt-5 space-y-5" aria-label="Published cashback offers">
      {!data?.publishedPromotions.length && <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><Megaphone className="mx-auto h-9 w-9 text-slate-400"/><h2 className="mt-3 text-lg font-bold text-slate-900">No published offers</h2><p className="mt-1 text-sm text-slate-600">Offers that have been reviewed and published will appear here.</p></div>}
      {data?.publishedPromotions.map(promotion => {
        const snapshot = snapshotForPromotion(promotion);
        return <article key={promotion.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900">Published · v{promotion.version}</span><h2 className="mt-2 text-lg font-bold text-slate-900">{snapshot.product.lender.name} · {snapshot.product.productName}</h2><p className="mt-1 text-sm font-semibold text-primary">{promotion.name} · {money(promotion.amount)}</p></div><button type="button" onClick={() => setEditing(editing === promotion.sourceSnapshotId ? null : promotion.sourceSnapshotId)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-primary/40 hover:text-primary"><Pencil className="h-4 w-4"/>{editing === promotion.sourceSnapshotId ? 'Close editor' : 'Edit offer'}</button></div>
          <OfferSummary promotion={promotion}/><SourceContent feature={promotion.sourceSnapshot.sourceFeature}/>
          {editing === promotion.sourceSnapshotId && <PromotionEditor key={`${promotion.sourceSnapshotId}-${promotion.id}`} snapshot={snapshot} initial={emptyForm(snapshot, promotion)} busy={busyId === promotion.sourceSnapshotId} onCancel={() => setEditing(null)} onPublish={values => void review(snapshot, 'PUBLISH', values)}/>}
        </article>;
      })}
    </section>}
    <div className="mt-8"><Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-primary">Back to admin dashboard <ArrowRight className="h-4 w-4"/></Link></div>
  </main>;
}

function SourceContent({ feature }: { feature: Feature }) {
  const info = typeof feature.additionalInfo === 'string' ? feature.additionalInfo : typeof feature.description === 'string' ? feature.description : '';
  const uri = typeof feature.additionalInfoUri === 'string' ? feature.additionalInfoUri : '';
  return <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">Bank offer information</summary><div className="space-y-3 border-t border-slate-200 p-4">{info && <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{info}</p>}{uri && <a href={uri} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline">Open bank source <ExternalLink className="h-3.5 w-3.5"/></a>}{!info && !uri && <p className="text-sm text-slate-500">No bank description or source link was provided.</p>}</div></details>;
}

function OfferSummary({ promotion }: { promotion: Promotion }) {
  const conditions = [
    promotion.requiredGoal ? humanize(promotion.requiredGoal) : 'Any loan purpose',
    promotion.firstHomeBuyerOnly ? 'First home buyers only' : 'No first-home restriction',
    promotion.minimumLoanAmount ? `Min loan ${money(promotion.minimumLoanAmount)}` : null,
    promotion.maximumLoanAmount ? `Max loan ${money(promotion.maximumLoanAmount)}` : null,
    promotion.applicationWindowStart || promotion.applicationWindowEnd ? `Applications: ${dateLabel(promotion.applicationWindowStart) ?? 'Any date'} – ${dateLabel(promotion.applicationWindowEnd) ?? 'No end date'}` : null,
    promotion.settlementWithinDays !== null ? `Settle within ${promotion.settlementWithinDays} days` : null,
    promotion.drawdownWithinDays !== null ? `Drawdown within ${promotion.drawdownWithinDays} days` : null,
  ].filter(Boolean);
  return <div className="mt-4 rounded-xl bg-emerald-50/70 p-4"><p className="text-xs font-bold uppercase tracking-wide text-emerald-900">Structured conditions</p><ul className="mt-2 flex flex-wrap gap-2">{conditions.map(condition => <li key={condition} className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700">{condition}</li>)}</ul>{promotion.terms && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{promotion.terms}</p>}{(promotion.validFrom || promotion.validUntil) && <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-600"><Clock3 className="h-3.5 w-3.5"/>Offer validity: {dateLabel(promotion.validFrom) ?? 'No start date'} – {dateLabel(promotion.validUntil) ?? 'No end date'}</p>}</div>;
}

function PromotionEditor({ snapshot, initial, busy, onCancel, onPublish }: { snapshot: SourceRevision; initial: FormValue; busy: boolean; onCancel: () => void; onPublish: (values: FormValue) => void }) {
  const [form, setForm] = useState(initial);
  const set = <K extends keyof FormValue>(key: K, value: FormValue[K]) => setForm(current => ({ ...current, [key]: value }));
  const fieldClass = 'mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-slate-100';
  const labelClass = 'block text-sm font-medium text-slate-700';
  const hiddenRemoved = snapshot.changeType === 'REMOVED';
  return <form className="mt-5 rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 sm:p-5" onSubmit={event => { event.preventDefault(); onPublish(form); }}>
    <h3 className="font-bold text-slate-900">Offer details used by matching</h3><p className="mt-1 text-sm text-slate-600">Only the fields below affect whether this cashback is included in a customer’s comparison cost.</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className={labelClass}>Offer name<input required maxLength={200} value={form.name} onChange={event => set('name', event.target.value)} className={fieldClass}/></label>
      <label className={labelClass}>Cashback amount (AUD)<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={event => set('amount', event.target.value)} className={fieldClass}/></label>
      <label className={labelClass}>Loan purpose<select value={form.requiredGoal} onChange={event => set('requiredGoal', event.target.value)} className={fieldClass}><option value="">Any purpose</option><option value="BUY">Purchase</option><option value="REFINANCE">Refinance</option></select></label>
      <label className={labelClass}>Minimum loan amount<input type="number" min="0" step="1000" value={form.minimumLoanAmount} onChange={event => set('minimumLoanAmount', event.target.value)} className={fieldClass}/></label>
      <label className={labelClass}>Maximum loan amount<input type="number" min="0" step="1000" value={form.maximumLoanAmount} onChange={event => set('maximumLoanAmount', event.target.value)} className={fieldClass}/></label>
      <label className="flex items-center gap-3 self-end rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.firstHomeBuyerOnly} onChange={event => set('firstHomeBuyerOnly', event.target.checked)} className="h-4 w-4 accent-primary"/>First home buyers only</label>
      <label className={labelClass}>Application window starts<input type="date" value={form.applicationWindowStart} onChange={event => set('applicationWindowStart', event.target.value)} className={fieldClass}/></label>
      <label className={labelClass}>Application window ends<input type="date" value={form.applicationWindowEnd} onChange={event => set('applicationWindowEnd', event.target.value)} className={fieldClass}/></label>
      <label className={labelClass}>Settlement within (days)<input type="number" min="0" max="3650" value={form.settlementWithinDays} onChange={event => set('settlementWithinDays', event.target.value)} className={fieldClass}/></label>
      <label className={labelClass}>Drawdown within (days)<input type="number" min="0" max="3650" value={form.drawdownWithinDays} onChange={event => set('drawdownWithinDays', event.target.value)} className={fieldClass}/></label>
      <label className={labelClass}>Offer valid from<input type="date" value={form.validFrom} onChange={event => set('validFrom', event.target.value)} className={fieldClass}/></label>
      <label className={labelClass}>Offer valid until<input type="date" value={form.validUntil} onChange={event => set('validUntil', event.target.value)} className={fieldClass}/></label>
      <label className={`${labelClass} sm:col-span-2 lg:col-span-3`}>Terms / notes<textarea rows={3} value={form.terms} onChange={event => set('terms', event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"/></label>
    </div>
    <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" onClick={onCancel} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><X className="h-4 w-4"/>Cancel</button><button type="submit" disabled={busy || hiddenRemoved} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <CheckCircle2 className="h-4 w-4"/>}Publish cashback offer</button></div>
  </form>;
}
