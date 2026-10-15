'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, BellRing, LoaderCircle } from 'lucide-react';

type FollowUp = { id: string; goal: string; propertyPostcode: string | null; recommendationPresentedAt: string | null; createdAt: string; matchCount: number; user: { fullName: string | null; email: string; phone: string | null } };
const date = (value: string) => new Date(value).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });

export default function AdminFollowUpsPage() {
  const [applications, setApplications] = useState<FollowUp[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch('/api/admin/follow-ups', { cache: 'no-store' });
        const body = await response.json() as { applications?: FollowUp[]; error?: string };
        if (!response.ok || !body.applications) throw new Error(body.error || 'Could not load follow-ups.');
        if (active) setApplications(body.applications);
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Could not load follow-ups.'); }
    })();
    return () => { active = false; };
  }, []);

  return <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
    <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft className="h-4 w-4"/>Admin dashboard</Link>
    <header className="mt-5"><p className="text-sm font-bold uppercase tracking-widest text-primary">Customer follow-up</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Recommendation follow-ups</h1><p className="mt-2 max-w-3xl text-slate-600">Applications appear here when the customer has viewed their recommendations for at least seven days without starting an application for a product.</p></header>
    {error && <div role="alert" className="mt-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="h-5 w-5"/>{error}</div>}
    {!applications && !error && <div className="flex justify-center py-20 text-slate-500"><LoaderCircle className="mr-2 h-5 w-5 animate-spin"/>Loading follow-ups…</div>}
    {applications && (applications.length === 0 ? <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-10 text-center"><BellRing className="mx-auto h-8 w-8 text-slate-400"/><h2 className="mt-3 text-lg font-bold text-slate-900">No follow-ups due</h2><p className="mt-1 text-sm text-slate-600">Customers who meet the seven-day follow-up rule will appear here.</p></section> : <section className="mt-7 space-y-3">{applications.map(application => <article key={application.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="min-w-0"><h2 className="font-bold text-slate-900">{application.user.fullName || 'Name not provided'}</h2><p className="mt-1 text-sm text-slate-700">{application.user.email} · {application.user.phone || 'No phone provided'}</p><p className="mt-1 text-sm text-slate-600">{application.goal === 'BUY' ? 'Home purchase' : 'Refinance'}{application.propertyPostcode ? ` · ${application.propertyPostcode}` : ''} · {application.matchCount} matches</p><p className="mt-1 text-xs text-slate-500">Recommendations viewed {application.recommendationPresentedAt ? date(application.recommendationPresentedAt) : 'Unknown'}</p></div><Link href={`/admin/applications/${application.id}`} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-white">Review application<ArrowRight className="h-4 w-4"/></Link></article>)}</section>)}
  </main>;
}
