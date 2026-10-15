'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, LoaderCircle, Search, Users } from 'lucide-react';

type AdminApplication = {
  id: string;
  goal: string;
  propertyPostcode: string | null;
  currentStage: string;
  createdAt: string;
  recommendationStatus: string;
  matchCount: number;
};
type AdminUser = {
  id: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  role: string;
  createdAt: string;
  applicationCount: number;
  applications: AdminApplication[];
};
type ResponseData = { users: AdminUser[]; total: number; page: number; pageSize: number; error?: string };

const date = (value: string) => new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase());

export default function AdminUsersPage() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ResponseData | null>(null);
  const [error, setError] = useState('');

  const fetchUsers = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) });
    if (submittedQuery) params.set('q', submittedQuery);
    const response = await fetch(`/api/admin/users?${params}`, { cache: 'no-store' });
    const body = await response.json() as ResponseData;
    if (!response.ok) throw new Error(body.error || 'Could not load user records.');
    return body;
  }, [page, submittedQuery]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const body = await fetchUsers();
        if (active) { setError(''); setData(body); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load user records.');
      }
    })();
    return () => { active = false; };
  }, [fetchUsers]);

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSubmittedQuery(query.trim());
  };

  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-bold uppercase tracking-widest text-primary">Admin workspace</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Users and applications</h1><p className="mt-2 text-slate-600">Review customer applications and the matches generated for each one.</p></div>
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"><Users className="mr-2 inline h-4 w-4 text-primary" />{data ? `${data.total} users` : 'Loading users'}</div>
    </div>

    <form onSubmit={submitSearch} className="mt-7 flex max-w-xl gap-2">
      <label className="relative flex-1"><span className="sr-only">Search by name or email</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name or email" className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>
      <button className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary/90">Search</button>
    </form>

    {error && <div role="alert" className="mt-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="h-5 w-5" />{error}</div>}
    {!data && !error && <div className="flex justify-center py-20 text-slate-500"><LoaderCircle className="mr-2 h-5 w-5 animate-spin" />Loading users…</div>}
    {data && <div className="mt-6 space-y-4">
      {data.users.length === 0 && <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">No users found.</div>}
      {data.users.map(user => <article key={user.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:px-6">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-lg font-bold text-slate-900">{user.fullName || 'Name not provided'}</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{label(user.role)}</span></div><p className="mt-1 text-sm text-slate-700">{user.email}</p><p className="mt-1 text-xs text-slate-500">{user.phone || 'No phone'} · Registered {date(user.createdAt)}</p></div>
          <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">{user.applicationCount} {user.applicationCount === 1 ? 'application' : 'applications'}</span>
        </div>
        {user.applicationCount > 0 && <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:p-5">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Recent applications</h3>
          <div className="space-y-2">{user.applications.map(application => <div key={application.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <div><p className="font-semibold text-slate-900">{application.goal === 'BUY' ? 'Home purchase' : label(application.goal)}{application.propertyPostcode ? ` · ${application.propertyPostcode}` : ''}</p><p className="mt-1 text-xs text-slate-500">{label(application.currentStage)} · {application.matchCount} matches · {date(application.createdAt)}</p></div>
            <Link href={`/admin/applications/${application.id}`} className="inline-flex items-center gap-2 rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-white">Review application <ArrowRight className="h-4 w-4" /></Link>
          </div>)}</div>
          {user.applicationCount > user.applications.length && <p className="mt-3 text-xs text-slate-500">Showing the 5 most recent applications.</p>}
        </div>}
      </article>)}
      <div className="flex items-center justify-between py-3 text-sm text-slate-600"><span>Page {data.page} of {Math.max(1, Math.ceil(data.total / data.pageSize))}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))} className="rounded-full border border-slate-300 px-4 py-2 font-semibold disabled:opacity-40">Previous</button><button type="button" disabled={page * data.pageSize >= data.total} onClick={() => setPage(value => value + 1)} className="rounded-full border border-slate-300 px-4 py-2 font-semibold disabled:opacity-40">Next</button></div></div>
    </div>}
  </main>;
}
