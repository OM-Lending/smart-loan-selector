import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthenticatedProfile } from '@/server/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const identity = await getAuthenticatedProfile();
  if (!identity) redirect('/login?next=%2Fadmin%2Fdashboard');
  if (!identity.profile || identity.profile.role !== 'ADMIN' || identity.profile.deletedAt) redirect('/dashboard');

  return <div className="min-h-[calc(100vh-8rem)] bg-slate-50">
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">OpenLending</p><p className="mt-1 text-sm font-semibold text-slate-800">Administration</p></div>
        <nav aria-label="Admin sections" className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <Link href="/admin/dashboard" className="rounded-full px-3 py-2 text-slate-700 hover:bg-slate-100 hover:text-primary">Overview</Link>
          <Link href="/admin/users" className="rounded-full px-3 py-2 text-slate-700 hover:bg-slate-100 hover:text-primary">Users & applications</Link>
          <Link href="/admin/applications/review" className="rounded-full px-3 py-2 text-slate-700 hover:bg-slate-100 hover:text-primary">Submitted applications</Link>
          <Link href="/admin/promotions" className="rounded-full px-3 py-2 text-slate-700 hover:bg-slate-100 hover:text-primary">Cashback offers</Link>
          <Link href="/dashboard" className="rounded-full border border-slate-200 px-3 py-2 text-slate-600 hover:border-primary/40 hover:text-primary">Customer dashboard</Link>
        </nav>
      </div>
    </div>
    {children}
  </div>;
}
