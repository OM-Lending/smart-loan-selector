'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, ClipboardList, Clock3, Plus, Sparkles } from 'lucide-react';

type Application = {
  id: string;
  goal: 'BUY' | 'REFINANCE' | string;
  purchasePrice: string | null;
  deposit: string | null;
  propertyValue: string | null;
  currentLoanBalance: string | null;
  propertyPostcode: string | null;
  currentStage: string;
  createdAt: string;
  recommendationStatus: string;
  recommendationCreatedAt: string | null;
  recommendationCount: number;
  continuation: { status: string; reviewStatus: string; brokerNote: string | null; selectedQuote: { id: string; lenderName: string; productName: string } } | null;
};

type ApplicationListResponse = { success: boolean; applications: Application[]; error?: string };

const currency = (value: string | null) => value
  ? new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Number(value))
  : 'Not provided';

function applicationSummary(application: Application) {
  if (application.goal === 'BUY') {
    const loanAmount = Number(application.purchasePrice ?? 0) - Number(application.deposit ?? 0);
    return [
      { label: 'Purchase price', value: currency(application.purchasePrice) },
      { label: 'Deposit', value: currency(application.deposit) },
      { label: 'Estimated loan', value: loanAmount > 0 ? currency(String(loanAmount)) : 'Not provided' },
    ];
  }
  return [
    { label: 'Property value', value: currency(application.propertyValue) },
    { label: 'Current loan', value: currency(application.currentLoanBalance) },
  ];
}

function recommendationLabel(application: Application) {
  if (application.recommendationCount > 0) return `${application.recommendationCount} matches ready`;
  if (application.recommendationStatus === 'FAILED') return 'Could not complete matching';
  if (application.recommendationStatus === 'RUNNING' || application.recommendationStatus === 'PENDING') return 'Matching in progress';
  return 'No matches yet';
}

function applicationProgress(application: Application) {
  if (application.continuation?.reviewStatus === 'NEEDS_INFORMATION') return 'Your broker has requested more information';
  if (application.currentStage === 'BROKER_REVIEW') {
    if (application.continuation?.reviewStatus === 'IN_REVIEW') return 'A broker is reviewing your application';
    if (application.continuation?.reviewStatus === 'READY_TO_SUBMIT') return 'Your application is ready for the next step';
    return 'Waiting for broker review';
  }
  if (application.continuation?.status === 'DRAFT') return 'Application in progress';
  if (application.currentStage === 'DOCUMENTS_PENDING') return 'More information is needed to continue';
  return null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch('/api/application', { cache: 'no-store' });
        const body = await response.json() as ApplicationListResponse;
        if (response.status === 401) {
          router.replace('/login?next=%2Fdashboard');
          return;
        }
        if (!response.ok) throw new Error(body.error || 'Could not load your applications.');
        if (active) setApplications(body.applications);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load your applications.');
      }
    })();
    return () => { active = false; };
  }, [router]);

  return <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-bold uppercase tracking-widest text-primary">Your account</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Your applications</h1><p className="mt-2 text-slate-600">Choose an application to view its loan matches and details.</p></div>
        <Link href="/get-started" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary/90"><Plus className="h-4 w-4" />Start an application</Link>
      </div>

      {error && <div role="alert" className="mt-8 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="h-5 w-5 shrink-0" />{error}</div>}
      {applications === null && !error && <div className="flex justify-center py-20 text-slate-500"><Clock3 className="mr-2 h-5 w-5 animate-pulse" />Loading your applications…</div>}
      {applications?.length === 0 && <section className="mt-10 rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm"><ClipboardList className="mx-auto h-10 w-10 text-primary" /><h2 className="mt-4 text-xl font-bold text-slate-900">No applications yet</h2><p className="mt-2 text-slate-600">Start an application to see loan options matched to your circumstances.</p><Link href="/get-started" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-white">Get started <ArrowRight className="h-4 w-4" /></Link></section>}

      {applications && applications.length > 0 && <div className="mt-8 space-y-4">{applications.map(application => <article key={application.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{application.goal === 'BUY' ? 'Buying a home' : application.goal === 'REFINANCE' ? 'Refinancing' : application.goal}</span><span className="inline-flex items-center gap-1.5 text-sm text-slate-600"><Sparkles className="h-4 w-4 text-primary" />{recommendationLabel(application)}</span></div>
            <h2 className="mt-3 text-lg font-bold text-slate-900">{application.propertyPostcode ? `Property postcode ${application.propertyPostcode}` : 'Home loan application'}</h2>
            <p className="mt-1 text-sm text-slate-500">Created {new Date(application.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {application.continuation && <Link href={application.continuation.reviewStatus === 'NEEDS_INFORMATION' ? `/applications/${application.id}/continue` : application.continuation.status === 'SUBMITTED' ? `/applications/${application.id}/details` : `/applications/${application.id}/continue`} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90">{application.continuation.reviewStatus === 'NEEDS_INFORMATION' ? 'Update requested information' : application.continuation.status === 'SUBMITTED' ? 'View application' : 'Continue application'} <ArrowRight className="h-4 w-4" /></Link>}
            <Link href={`/applications/${application.id}/recommendations`} className="inline-flex items-center gap-2 rounded-xl border border-primary px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5">View matches <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
        {applicationProgress(application) && <div className={`mt-4 rounded-xl border px-4 py-3 ${application.continuation?.reviewStatus === 'NEEDS_INFORMATION' ? 'border-amber-200 bg-amber-50' : 'border-primary/15 bg-primary/5'}`}><p className="text-xs font-bold uppercase tracking-wide text-primary">Application status</p><p className="mt-1 text-sm font-semibold text-slate-900">{applicationProgress(application)}</p>{application.continuation?.brokerNote && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{application.continuation.brokerNote}</p>}</div>}
        {application.continuation && <div className="mt-4 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3"><p className="text-xs font-bold uppercase tracking-wide text-primary">Selected product for this application</p><p className="mt-1 text-sm font-semibold text-slate-900">{application.continuation.selectedQuote.lenderName} · {application.continuation.selectedQuote.productName}</p></div>}
        <dl className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">{applicationSummary(application).map(item => <div key={item.label}><dt className="text-xs font-medium text-slate-500">{item.label}</dt><dd className="mt-1 font-semibold tabular-nums text-slate-900">{item.value}</dd></div>)}</dl>
      </article>)}</div>}
    </div>
  </main>;
}
