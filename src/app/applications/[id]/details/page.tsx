'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, ExternalLink, FileText, LoaderCircle } from 'lucide-react';
import { applicationDocumentTitle } from '@/lib/application-documents';

type SubmittedDocument = { id: string; category: string; fileName: string; sizeBytes: number; uploadedAt: string };
type SubmittedApplication = {
  applicationId: string;
  goal: string;
  currentStage: string;
  continuation: {
    status: string;
    reviewStatus: string;
    brokerNote: string | null;
    submittedAt: string | null;
    details: Record<string, unknown>;
    selectedQuote: { lenderName: string; productName: string; rate: string; rateType: string; repayment: string };
    documents: SubmittedDocument[];
  } | null;
};

const humanize = (value: string) => value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

function SubmittedValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') return <span className="text-slate-400">Not provided</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (Array.isArray(value)) return value.length ? <ul className="mt-1 space-y-2">{value.map((item, index) => <li key={index} className="rounded-lg bg-white p-3"><SubmittedValue value={item} /></li>)}</ul> : <span>None</span>;
  if (typeof value === 'object') return <dl className="mt-2 grid gap-2 sm:grid-cols-2">{Object.entries(record(value)).filter(([key]) => key !== 'selection' && !key.endsWith('Selection')).map(([key, item]) => <div key={key} className="rounded-lg bg-white p-3"><dt className="text-xs font-medium text-slate-500">{humanize(key)}</dt><dd className="mt-1 break-words text-sm text-slate-800"><SubmittedValue value={item} /></dd></div>)}</dl>;
  return <span className="whitespace-pre-wrap">{typeof value === 'string' && /^[A-Z0-9_]+$/.test(value) ? humanize(value) : String(value)}</span>;
}

function statusLabel(status: string) {
  if (status === 'IN_REVIEW') return 'A broker is reviewing your application';
  if (status === 'NEEDS_INFORMATION') return 'Your broker has requested more information';
  if (status === 'READY_TO_SUBMIT') return 'Your application is ready for the next step';
  return 'Waiting for broker review';
}

export default function SubmittedApplicationDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [application, setApplication] = useState<SubmittedApplication | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/application/${id}/continuation`, { cache: 'no-store' });
        if (response.status === 401) { router.replace(`/login?next=${encodeURIComponent(`/applications/${id}/details`)}`); return; }
        const body = await response.json() as { error?: string } & SubmittedApplication;
        if (!response.ok) throw new Error(body.error || 'Could not load your submitted application.');
        if (active) setApplication(body);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load your submitted application.');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [id, router]);

  if (loading) return <main className="flex min-h-[60vh] items-center justify-center text-slate-600"><LoaderCircle className="mr-2 h-5 w-5 animate-spin" />Loading your application…</main>;

  const continuation = application?.continuation;
  const isSubmitted = continuation?.status === 'SUBMITTED';
  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8"><div className="mx-auto max-w-4xl">
    <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-primary"><ArrowLeft className="h-4 w-4" />Back to your applications</Link>
    {error && <p role="alert" className="mt-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="h-5 w-5 shrink-0" />{error}</p>}
    {application && <>
      <header className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-bold uppercase tracking-widest text-primary">Your application</p><h1 className="mt-2 text-3xl font-extrabold text-slate-900">Submitted application details</h1><p className="mt-2 text-slate-600">Review the information and supporting documents you sent to your broker.</p>
        {continuation && <div className="mt-5 rounded-xl border border-primary/15 bg-primary/5 p-4"><p className="text-xs font-bold uppercase tracking-wide text-primary">Application status</p><p className="mt-1 font-semibold text-slate-900">{isSubmitted ? statusLabel(continuation.reviewStatus) : 'Application in progress'}</p>{continuation.submittedAt && <p className="mt-1 text-sm text-slate-600">Submitted {new Date(continuation.submittedAt).toLocaleString('en-AU')}</p>}{continuation.brokerNote && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{continuation.brokerNote}</p>}</div>}
      </header>
      {!continuation && <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-bold text-slate-900">You have not started an application for this product yet.</h2><Link href={`/applications/${id}/recommendations`} className="mt-4 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-bold text-white">View recommendations</Link></section>}
      {continuation && <>
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold text-slate-900">Selected product</h2><p className="mt-2 font-semibold text-slate-800">{continuation.selectedQuote.lenderName} · {continuation.selectedQuote.productName}</p><p className="mt-1 text-sm text-slate-600">{continuation.selectedQuote.rate}% p.a. · {humanize(continuation.selectedQuote.rateType)} · {humanize(continuation.selectedQuote.repayment)}</p></section>
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold text-slate-900">Information provided</h2><div className="mt-4 space-y-4">{Object.entries(continuation.details).map(([key, value]) => <div key={key} className="rounded-xl bg-slate-50 p-4"><h3 className="font-semibold text-slate-900">{humanize(key)}</h3><div className="mt-2 text-sm leading-6 text-slate-700"><SubmittedValue value={value} /></div></div>)}</div></section>
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold text-slate-900">Supporting documents</h2>{continuation.documents.length === 0 ? <p className="mt-2 text-sm text-slate-600">No supporting documents have been uploaded.</p> : <ul className="mt-4 space-y-2">{continuation.documents.map(document => <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div className="flex min-w-0 items-center gap-3"><FileText className="h-5 w-5 shrink-0 text-primary"/><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-primary">{applicationDocumentTitle(document.category)}</p><p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{document.fileName}</p><p className="mt-1 text-xs text-slate-500">{(document.sizeBytes / (1024 * 1024)).toFixed(1)} MB</p></div></div><a href={`/api/application/${id}/continuation/documents/${document.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary hover:underline">View file<ExternalLink className="h-4 w-4"/></a></li>)}</ul>}</section>
        {continuation.reviewStatus === 'NEEDS_INFORMATION' && <Link href={`/applications/${id}/continue`} className="mt-5 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-bold text-white">Update requested information</Link>}
      </>}
    </>}
  </div></main>;
}
