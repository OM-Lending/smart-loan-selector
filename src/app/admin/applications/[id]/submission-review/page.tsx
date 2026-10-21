'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, CheckCircle2, ExternalLink, LoaderCircle, Save } from 'lucide-react';
import { applicationDocumentTitle } from '@/lib/application-documents';

type BrokerDocument = { id: string; category: string; fileName: string; contentType: string; sizeBytes: number; uploadedAt: string };
type Continuation = {
  reviewStatus: 'NEW' | 'IN_REVIEW' | 'NEEDS_INFORMATION' | 'READY_TO_SUBMIT';
  brokerNote: string | null;
  submittedAt: string | null;
  details: Record<string, unknown>;
  selectedQuote: { lenderName: string; productName: string; quotedRate: string; quotedRateType: string; quotedRepayment: string };
  documents: BrokerDocument[];
};
type BrokerApplication = {
  id: string; goal: string; currentStage: string; propertyPostcode: string | null;
  purchasePrice: string | null; deposit: string | null; propertyValue: string | null; currentLoanBalance: string | null;
  createdAt: string; customer: { fullName: string | null; email: string; phone: string | null }; continuation: Continuation;
};

const humanize = (value: string) => value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const currency = (value: string | null) => value === null ? 'Not provided' : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Number(value));

function DetailValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') return <span className="text-slate-400">Not provided</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (Array.isArray(value)) return value.length ? <ul className="mt-1 space-y-1">{value.map((item, index) => <li key={index} className="rounded-lg bg-white p-2"><DetailValue value={item} /></li>)}</ul> : <span>None</span>;
  if (typeof value === 'object') return <dl className="mt-2 grid gap-2 sm:grid-cols-2">{Object.entries(record(value)).map(([key, item]) => <div key={key} className="rounded-lg bg-white p-2"><dt className="text-xs font-medium text-slate-500">{humanize(key)}</dt><dd className="mt-1 break-words text-sm text-slate-800"><DetailValue value={item} /></dd></div>)}</dl>;
  return <span>{typeof value === 'string' && /^[A-Z0-9_]+$/.test(value) ? humanize(value) : String(value)}</span>;
}

export default function BrokerApplicationReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [application, setApplication] = useState<BrokerApplication | null>(null);
  const [reviewStatus, setReviewStatus] = useState<Continuation['reviewStatus']>('NEW');
  const [brokerNote, setBrokerNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/applications/${id}/continuation`, { cache: 'no-store' });
    const body = await response.json() as { application?: BrokerApplication; error?: string };
    if (response.status === 401) { router.replace(`/login?next=${encodeURIComponent(`/admin/applications/${id}/submission-review`)}`); return; }
    if (!response.ok || !body.application) throw new Error(body.error || 'Could not load this application.');
    setApplication(body.application);
    setReviewStatus(body.application.continuation.reviewStatus);
    setBrokerNote(body.application.continuation.brokerNote ?? '');
  }, [id, router]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try { await load(); }
      catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Could not load this application.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [load]);

  async function saveReview() {
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/applications/${id}/continuation`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewStatus, brokerNote: brokerNote.trim() || null }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || 'Could not save the review update.');
      setNotice('Review status saved.');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the review update.'); }
    finally { setSaving(false); }
  }

  if (loading) return <main className="flex min-h-[60vh] items-center justify-center text-slate-600"><LoaderCircle className="mr-2 h-5 w-5 animate-spin" />Loading application…</main>;
  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
    <Link href="/admin/applications/review" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-primary"><ArrowLeft className="h-4 w-4" />Back to application review</Link>
    {error && <p role="alert" className="mt-5 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="h-5 w-5 shrink-0" />{error}</p>}
    {notice && <p role="status" className="mt-5 flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="h-5 w-5 shrink-0" />{notice}</p>}
    {application && <>
      <header className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-widest text-primary">Admin application review</p><h1 className="mt-2 text-2xl font-extrabold text-slate-900">{application.customer.fullName || 'Customer application'}</h1><p className="mt-2 text-sm text-slate-600">{application.goal === 'BUY' ? 'Home purchase' : 'Refinance'}{application.propertyPostcode ? ` · ${application.propertyPostcode}` : ''} · Submitted {application.continuation.submittedAt ? new Date(application.continuation.submittedAt).toLocaleString('en-AU') : 'date unavailable'}</p><div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3"><div><p className="text-xs text-slate-500">Email</p><a className="mt-1 break-all font-semibold text-primary hover:underline" href={`mailto:${application.customer.email}`}>{application.customer.email}</a></div><div><p className="text-xs text-slate-500">Phone</p><a className="mt-1 font-semibold text-primary hover:underline" href={application.customer.phone ? `tel:${application.customer.phone}` : undefined}>{application.customer.phone || 'Not provided'}</a></div><div><p className="text-xs text-slate-500">Selected product</p><p className="mt-1 font-semibold text-slate-900">{application.continuation.selectedQuote.lenderName} · {application.continuation.selectedQuote.productName}</p><p className="text-sm text-slate-600">{application.continuation.selectedQuote.quotedRate}% p.a.</p></div></div></header>
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold text-slate-900">Application summary</h2><dl className="mt-4 grid gap-3 sm:grid-cols-2"><Summary label="Purchase price" value={currency(application.purchasePrice)} /><Summary label="Deposit" value={currency(application.deposit)} /><Summary label="Property value" value={currency(application.propertyValue)} /><Summary label="Current loan balance" value={currency(application.currentLoanBalance)} /></dl></section>
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold text-slate-900">Customer-provided details</h2><div className="mt-4 space-y-4">{Object.entries(application.continuation.details).map(([key, value]) => <div key={key} className="rounded-xl bg-slate-50 p-4"><h3 className="font-semibold text-slate-900">{humanize(key)}</h3><div className="mt-2 text-sm text-slate-700"><DetailValue value={value} /></div></div>)}</div></section>
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold text-slate-900">Supporting documents</h2>{application.continuation.documents.length === 0 ? <p className="mt-2 text-sm text-slate-600">No documents were uploaded.</p> : <ul className="mt-4 space-y-2">{application.continuation.documents.map(document => <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-primary">{applicationDocumentTitle(document.category)}</p><p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{document.fileName}</p><p className="mt-1 text-xs text-slate-500">{(document.sizeBytes / (1024 * 1024)).toFixed(1)} MB · {new Date(document.uploadedAt).toLocaleDateString('en-AU')}</p></div><a href={`/api/admin/applications/${id}/continuation/documents/${document.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary hover:underline">Open document<ExternalLink className="h-4 w-4" /></a></li>)}</ul>}</section>
      <section className="mt-5 rounded-2xl border border-primary/20 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold text-slate-900">Review progress</h2><p className="mt-1 text-sm text-slate-600">Update the review status. If more information is needed, add a clear note that the customer can see in their application.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="block"><span className="text-sm font-semibold text-slate-700">Status</span><select value={reviewStatus} onChange={event => setReviewStatus(event.target.value as Continuation['reviewStatus'])} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"><option value="NEW">New</option><option value="IN_REVIEW">In review</option><option value="NEEDS_INFORMATION">Needs information</option><option value="READY_TO_SUBMIT">Ready to submit</option></select></label><label className="block sm:col-span-2"><span className="text-sm font-semibold text-slate-700">Note for the customer</span><textarea value={brokerNote} onChange={event => setBrokerNote(event.target.value)} maxLength={2000} rows={4} placeholder="Add the next steps or list any information the customer needs to provide." className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm" /></label></div><button type="button" onClick={() => void saveReview()} disabled={saving} className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Saving…' : 'Save review update'}</button></section>
    </>}
  </main>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-slate-900">{value}</dd></div>;
}
