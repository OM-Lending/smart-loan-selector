'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LoaderCircle, MessageSquare, Search } from 'lucide-react';
import { ENQUIRY_STATUSES, ENQUIRY_STATUS_LABELS } from '@/lib/validations/broker-enquiry';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Item = { id: string; fullName: string; email: string; phone: string; status: typeof ENQUIRY_STATUSES[number]; createdAt: string; assignedTo: { fullName: string | null; email: string } | null };
export default function BrokerEnquiriesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true); setError('');
      try {
        const params = new URLSearchParams({ search: query, page: String(page), sort });
        if (status !== 'ALL') params.set('status', status);
        const response = await fetch(`/api/admin/broker-enquiries?${params}`, { cache: 'no-store', signal: controller.signal });
        const body = await response.json() as { items: Item[]; total: number; error?: string };
        if (!response.ok) throw new Error(body.error || 'Could not load enquiries.');
        setItems(body.items); setTotal(body.total);
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load enquiries.'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [page, query, sort, status]);
  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-widest text-primary">Customer enquiries</p><h1 className="mt-2 text-3xl font-extrabold text-slate-900">Broker enquiries</h1><p className="mt-2 text-slate-600">Review messages, record contact attempts and update the current status.</p></div><Link href="/admin/notifications" className="text-sm font-semibold text-primary hover:underline">Email notification history</Link></div>
    <form onSubmit={event => { event.preventDefault(); setPage(1); setQuery(search); }} className="mt-7 flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-4">
      <Input aria-label="Search enquiries" value={search} maxLength={120} onChange={event => setSearch(event.target.value)} placeholder="Search name, email or phone" className="min-w-48 flex-1" />
      <Button type="submit" variant="outline" className="gap-2"><Search className="h-4 w-4" />Search</Button>
      <Select value={status} onValueChange={value => { setStatus(value); setPage(1); }}><SelectTrigger aria-label="Enquiry status" className="w-60"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">All statuses</SelectItem>{ENQUIRY_STATUSES.map(value => <SelectItem key={value} value={value}>{ENQUIRY_STATUS_LABELS[value]}</SelectItem>)}</SelectContent></Select>
      <Select value={sort} onValueChange={value => { setSort(value); setPage(1); }}><SelectTrigger aria-label="Sort enquiries" className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="newest">Newest first</SelectItem><SelectItem value="oldest">Oldest first</SelectItem></SelectContent></Select>
    </form>
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {loading ? <p role="status" className="mt-8 flex items-center gap-2 text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin" />Loading enquiries…</p> : !items.length ? <div className="mt-6 rounded-2xl border bg-white p-10 text-center"><MessageSquare className="mx-auto h-8 w-8 text-slate-400" /><p className="mt-3 font-semibold">No enquiries found.</p></div> : <div className="mt-6 overflow-x-auto rounded-2xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-600"><tr>{['Customer', 'Status', 'Assigned to', 'Received', ''].map(label => <th key={label} className="px-5 py-4">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{items.map(item => <tr key={item.id}><td className="px-5 py-4"><p className="font-semibold text-slate-900">{item.fullName}</p><p className="mt-1 text-slate-500">{item.email}</p><p className="mt-1 text-slate-500">{item.phone}</p></td><td className="px-5 py-4"><span className="rounded-full bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">{ENQUIRY_STATUS_LABELS[item.status]}</span></td><td className="px-5 py-4">{item.assignedTo?.fullName ?? item.assignedTo?.email ?? 'Unassigned'}</td><td className="whitespace-nowrap px-5 py-4 text-slate-500">{new Date(item.createdAt).toLocaleString('en-AU')}</td><td className="px-5 py-4"><Link className="font-semibold text-primary hover:underline" href={`/admin/broker-enquiries/${item.id}`}>View enquiry</Link></td></tr>)}</tbody></table></div>}
    <div className="mt-5 flex items-center justify-between text-sm text-slate-600"><p>{total} enquiries · Page {page} of {Math.max(1, Math.ceil(total / 20))}</p><div className="flex gap-2"><Button variant="outline" disabled={page === 1 || loading} onClick={() => setPage(value => value - 1)}>Previous</Button><Button variant="outline" disabled={page * 20 >= total || loading} onClick={() => setPage(value => value + 1)}>Next</Button></div></div>
  </main>;
}
