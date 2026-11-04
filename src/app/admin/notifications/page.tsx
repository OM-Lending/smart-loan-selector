'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type Event = { id: string; type: string; applicationId: string | null; enquiryId: string | null; createdAt: string; deliveries: Array<{ id: string; recipientEmail: string; status: string; attemptCount: number; lastError: string | null; sentAt: string | null; nextAttemptAt: string | null }> };
type NotificationResponse = { items: Event[]; total: number; configured: boolean; environment: string; error?: string };
export default function NotificationsPage() {
  const [items, setItems] = useState<Event[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [environment, setEnvironment] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const fetchNotifications = useCallback(async () => {
    const response = await fetch(`/api/admin/notifications?page=${page}`, { cache: 'no-store' });
    const body = await response.json() as NotificationResponse;
    if (!response.ok) throw new Error(body.error || 'Could not load notifications.');
    return body;
  }, [page]);
  const applyNotifications = useCallback((body: NotificationResponse) => {
    setItems(body.items); setTotal(body.total); setConfigured(body.configured); setEnvironment(body.environment);
  }, []);
  const load = async () => {
    try { applyNotifications(await fetchNotifications()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load notifications.'); }
  };
  useEffect(() => {
    let active = true;
    void fetchNotifications().then(body => { if (active) applyNotifications(body); }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not load notifications.');
    });
    return () => { active = false; };
  }, [applyNotifications, fetchNotifications]);
  const retry = async (eventId: string) => {
    if (busy) return;
    setBusy(eventId); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || 'Could not retry notification.');
      setNotice('Sending has been queued. Refresh in a moment to see the result.'); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not retry notification.'); }
    finally { setBusy(''); }
  };
  const titles: Record<string, string> = { APPLICATION_CREATED: 'New application', APPLICATION_SUBMITTED: 'Application submitted', BROKER_ENQUIRY_CREATED: 'Broker enquiry' };
  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-bold text-slate-900">Email notifications</h1><p className="mt-2 text-sm text-slate-600">{environment && `${environment} · `}Sent means the email service accepted the message; it does not confirm inbox delivery.</p></div><Button variant="outline" onClick={() => { setError(''); void load(); }}>Refresh</Button></div>
    {configured === false && <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Email sending is disabled or not configured. Saved notifications remain queued. Ask your project administrator to configure the email service.</p>}
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    <div className="mt-6 space-y-4">{items.map(event => <article key={event.id} className="rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold">{titles[event.type] ?? 'Admin notification'}</h2><p className="mt-1 text-xs text-slate-500">{new Date(event.createdAt).toLocaleString('en-AU')}</p></div><div className="flex items-center gap-4"><Link className="text-sm font-semibold text-primary underline" href={event.enquiryId ? `/admin/broker-enquiries/${event.enquiryId}` : `/admin/applications/${event.applicationId}`}>View record</Link>{(!event.deliveries.length || event.deliveries.some(item => item.status === 'FAILED' || item.status === 'PENDING')) && <Button size="sm" variant="outline" disabled={!configured || Boolean(busy)} onClick={() => void retry(event.id)}>{busy === event.id ? 'Queuing…' : 'Send / retry'}</Button>}</div></div>
      {!event.deliveries.length ? <p className="mt-3 text-sm text-slate-500">Waiting to prepare recipients.</p> : <ul className="mt-3 divide-y">{event.deliveries.map(delivery => <li key={delivery.id} className="py-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span>{delivery.recipientEmail}</span><span className="font-semibold">{delivery.status.toLowerCase()} · {delivery.attemptCount} attempts</span></div>{delivery.status === 'FAILED' && <p className="mt-1 text-xs text-slate-500">{delivery.nextAttemptAt && delivery.attemptCount < 6 ? `Next automatic attempt: ${new Date(delivery.nextAttemptAt).toLocaleString('en-AU')}. Sending may occur later when the worker runs.` : 'Automatic retries have stopped. Use Send / retry to start a new round.'}</p>}{delivery.lastError && <p className="mt-1 text-xs text-red-700">{delivery.lastError}</p>}</li>)}</ul>}
    </article>)}</div>{configured !== null && !items.length && <p className="mt-8 text-slate-500">No notifications in this environment yet.</p>}
    <div className="mt-6 flex items-center justify-between"><p className="text-sm text-slate-500">{total} notifications · Page {page}</p><div className="flex gap-2"><Button variant="outline" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Previous</Button><Button variant="outline" disabled={page * 25 >= total} onClick={() => setPage(value => value + 1)}>Next</Button></div></div>
  </main>;
}
