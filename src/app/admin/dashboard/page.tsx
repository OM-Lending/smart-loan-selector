'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, BellRing, ClipboardCheck, CreditCard, LoaderCircle, Megaphone, Users } from 'lucide-react';

type Metrics = { userCount: number; applicationCount: number; cashbackReviewCount: number; followUpCount: number };

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch('/api/admin/overview', { cache: 'no-store' });
        const body = await response.json() as { metrics?: Metrics; error?: string };
        if (!response.ok || !body.metrics) throw new Error(body.error || 'Could not load the admin overview.');
        if (active) setMetrics(body.metrics);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load the admin overview.');
      }
    })();
    return () => { active = false; };
  }, []);

  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-widest text-primary">Admin workspace</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Dashboard</h1><p className="mt-2 text-slate-600">Choose a work area or review the current queue totals.</p></div>{!metrics && !error && <span className="inline-flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Loading overview</span>}</div>

    {error && <p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}

    <section aria-label="Overview metrics" className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={<Users className="h-5 w-5" />} label="Active users" value={metrics?.userCount} />
      <Metric icon={<CreditCard className="h-5 w-5" />} label="Applications" value={metrics?.applicationCount} />
      <Metric icon={<BellRing className="h-5 w-5" />} label="Follow-ups overdue" value={metrics?.followUpCount} accent />
      <Metric icon={<Megaphone className="h-5 w-5" />} label="Cashback changes to review" value={metrics?.cashbackReviewCount} accent />
    </section>

    <section className="mt-10"><div><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Work areas</p><h2 className="mt-1 text-xl font-bold text-slate-900">Operations</h2></div>
      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <ModuleCard icon={<ClipboardCheck className="h-6 w-6" />} eyebrow="Customer operations" title="Applications and match review" description="Search users, review their submitted questionnaires, and inspect or record decisions on the recommended matches within each application." href="/admin/users" action="Open applications" />
        <ModuleCard icon={<BellRing className="h-6 w-6" />} eyebrow="Customer follow-up" title="Recommendation follow-ups" description="Find customers whose recommendation report was shown at least seven days ago and who have not started an application for a product." href="/admin/follow-ups" action="Open follow-up list" />
        <ModuleCard icon={<Megaphone className="h-6 w-6" />} eyebrow="Product data" title="Cashback offers" description="Review new or changed bank offer text, maintain eligibility conditions, and publish current cashback offers for recommendations." href="/admin/promotions" action={metrics ? `Review ${metrics.cashbackReviewCount} changes` : 'Open cashback offers'} />
      </div>
    </section>
  </main>;
}

function Metric({ icon, label, value, accent = false }: { icon: React.ReactNode; label: string; value?: number; accent?: boolean }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent ? 'bg-amber-50 text-amber-700' : 'bg-primary/10 text-primary'}`}>{icon}</div><p className="mt-4 text-sm font-medium text-slate-500">{label}</p><p className="mt-1 text-3xl font-extrabold tabular-nums text-slate-900">{value ?? '—'}</p></article>;
}

function ModuleCard({ icon, eyebrow, title, description, href, action }: { icon: React.ReactNode; eyebrow: string; title: string; description: string; href: string; action: string }) {
  return <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</div><p className="mt-5 text-xs font-bold uppercase tracking-widest text-primary">{eyebrow}</p><h3 className="mt-1 text-lg font-bold text-slate-900">{title}</h3><p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{description}</p><Link href={href} className="mt-5 inline-flex items-center gap-2 self-start rounded-full border border-primary px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary hover:text-white">{action}<ArrowRight className="h-4 w-4" /></Link></article>;
}
