'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, ClipboardList, LoaderCircle } from 'lucide-react';

type ReviewApplication = {
  id: string;
  goal: string;
  propertyPostcode: string | null;
  currentStage: string;
  createdAt: string;
  customer: { fullName: string | null; email: string; phone: string | null };
  reviewStatus: string;
  submittedAt: string | null;
  selectedProduct: { lenderName: string; productName: string } | null;
  documentCount: number;
};

const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
const date = (value: string | null) => value ? new Date(value).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not available';

export default function AdminApplicationReviewQueuePage() {
  const [applications, setApplications] = useState<ReviewApplication[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch('/api/admin/applications/review', { cache: 'no-store' });
        const body = await response.json() as { applications?: ReviewApplication[]; error?: string };
        if (!response.ok || !body.applications) throw new Error(body.error || 'Could not load the review queue.');
        if (active) setApplications(body.applications);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load the review queue.');
      }
    })();
    return () => { active = false; };
  }, []);

  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <header><p className="text-sm font-bold uppercase tracking-widest text-primary">Admin workspace</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Submitted application review</h1><p className="mt-2 max-w-3xl text-slate-600">Review submitted customer details and supporting documents, then record the next step.</p></header>
    {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {!applications && !error && <div className="flex justify-center py-20 text-slate-500"><LoaderCircle className="mr-2 h-5 w-5 animate-spin" />Loading applications…</div>}
    {applications && (applications.length === 0
      ? <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-10 text-center"><ClipboardList className="mx-auto h-9 w-9 text-slate-400" /><h2 className="mt-3 text-lg font-bold text-slate-900">No applications waiting for review</h2><p className="mt-1 text-sm text-slate-600">Submitted applications will appear here.</p></section>
      : <section className="mt-7 space-y-3">{applications.map(application => <article key={application.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-slate-900">{application.customer.fullName || 'Name not provided'}</h2><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">{label(application.reviewStatus)}</span></div><p className="mt-1 text-sm text-slate-700">{application.customer.email} · {application.customer.phone || 'No phone provided'}</p><p className="mt-1 text-sm text-slate-600">{application.goal === 'BUY' ? 'Home purchase' : 'Refinance'}{application.propertyPostcode ? ` · ${application.propertyPostcode}` : ''} · {application.documentCount} documents</p><p className="mt-1 text-xs text-slate-500">Submitted {date(application.submittedAt)}{application.selectedProduct ? ` · ${application.selectedProduct.lenderName} · ${application.selectedProduct.productName}` : ''}</p></div>
        <Link href={`/admin/applications/${application.id}/submission-review`} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-white">Review application<ArrowRight className="h-4 w-4" /></Link>
      </article>)}</section>)}
  </main>;
}
