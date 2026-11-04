'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, LoaderCircle, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CONTACT_CHANNELS, CONTACT_OUTCOMES, ENQUIRY_STATUSES, ENQUIRY_STATUS_LABELS } from '@/lib/validations/broker-enquiry';

type Status = typeof ENQUIRY_STATUSES[number];
type Admin = { id: string; fullName: string | null; email: string };
type Activity = { id: string; type: string; channel: string | null; outcome: string | null; fromStatus: Status | null; toStatus: Status | null; note: string | null; createdAt: string; actor: { fullName: string | null; email: string } | null };
type Enquiry = { id: string; fullName: string; email: string; phone: string; message: string; status: Status; assignedToId: string | null; linkedApplicationId: string | null; createdAt: string; updatedAt: string; activities: Activity[] };
type Application = { id: string; goal: string; createdAt: string; continuation: { selectedQuote: { lenderName: string; productName: string } } | null };
type EnquiryResponse = { enquiry: Enquiry; admins: Admin[]; applications: Application[]; error?: string };
const pretty = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, character => character.toUpperCase());

export default function BrokerEnquiryPage() {
  const { id } = useParams<{ id: string }>();
  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [status, setStatus] = useState<Status>('NEW');
  const [assignedToId, setAssignedToId] = useState('none');
  const [linkedApplicationId, setLinkedApplicationId] = useState('none');
  const [channel, setChannel] = useState('none');
  const [outcome, setOutcome] = useState('none');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fetchEnquiry = useCallback(async () => {
    const response = await fetch(`/api/admin/broker-enquiries/${id}`, { cache: 'no-store' });
    const body = await response.json() as EnquiryResponse;
    if (!response.ok) throw new Error(body.error || 'Could not load enquiry.');
    return body;
  }, [id]);
  const applyEnquiry = useCallback((body: EnquiryResponse) => {
    setEnquiry(body.enquiry); setAdmins(body.admins); setApplications(body.applications);
    setStatus(body.enquiry.status); setAssignedToId(body.enquiry.assignedToId ?? 'none'); setLinkedApplicationId(body.enquiry.linkedApplicationId ?? 'none');
  }, []);
  const load = async () => {
    try { applyEnquiry(await fetchEnquiry()); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load enquiry.'); return false; }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let active = true;
    void fetchEnquiry().then(body => { if (active) applyEnquiry(body); }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not load enquiry.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applyEnquiry, fetchEnquiry]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!enquiry || saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/broker-enquiries/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        updatedAt: enquiry.updatedAt, status, assignedToId: assignedToId === 'none' ? null : assignedToId,
        linkedApplicationId: linkedApplicationId === 'none' ? null : linkedApplicationId,
        note, ...(channel === 'none' ? {} : { channel, outcome: outcome === 'none' ? undefined : outcome }),
      }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || 'Could not update enquiry.');
      setNote(''); setChannel('none'); setOutcome('none');
      if (await load()) setNotice('Enquiry updated.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update enquiry.'); }
    finally { setSaving(false); }
  };
  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
    <Link href="/admin/broker-enquiries" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><ArrowLeft className="h-4 w-4" />Back to enquiries</Link>
    {loading && <p className="mt-6 flex items-center gap-2"><LoaderCircle className="h-5 w-5 animate-spin" />Loading enquiry…</p>}
    {error && <div role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800"><p>{error}</p><button type="button" className="mt-2 font-semibold underline" onClick={() => { setError(''); void load(); }}>Reload enquiry</button></div>}
    {notice && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    {enquiry && <><header className="mt-5 rounded-2xl border bg-white p-6"><p className="text-xs font-bold uppercase tracking-wide text-primary">{ENQUIRY_STATUS_LABELS[enquiry.status]}</p><h1 className="mt-2 text-3xl font-bold text-slate-900">{enquiry.fullName}</h1><div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600"><a href={`mailto:${enquiry.email}`} className="text-primary underline">{enquiry.email}</a><a href={`tel:${enquiry.phone.replace(/[^+\d]/g, '')}`} className="text-primary underline">{enquiry.phone}</a><span>Received {new Date(enquiry.createdAt).toLocaleString('en-AU')}</span></div><h2 className="mt-6 text-sm font-bold">Customer message</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{enquiry.message}</p></header>
      <div className="mt-6 grid gap-6 lg:grid-cols-2"><form onSubmit={save} className="space-y-5 rounded-2xl border bg-white p-6"><h2 className="text-xl font-bold">Manage enquiry</h2><fieldset disabled={saving} className="space-y-5">
        <div><Label className="mb-2 block">Current status</Label><Select value={status} onValueChange={value => setStatus(value as Status)}><SelectTrigger aria-label="Current enquiry status"><SelectValue /></SelectTrigger><SelectContent>{ENQUIRY_STATUSES.filter(value => value !== 'NEW' || enquiry.status === 'NEW').map(value => <SelectItem key={value} value={value}>{ENQUIRY_STATUS_LABELS[value]}</SelectItem>)}</SelectContent></Select><p className="mt-2 text-xs text-slate-500">Contacting includes unsuccessful contact attempts. Use Resolved for an answered enquiry, or Closed when no further action is planned.</p></div>
        <div><Label className="mb-2 block">Assigned to</Label><Select value={assignedToId} onValueChange={setAssignedToId}><SelectTrigger aria-label="Assigned administrator"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Unassigned</SelectItem>{admins.map(admin => <SelectItem key={admin.id} value={admin.id}>{admin.fullName ?? admin.email}</SelectItem>)}</SelectContent></Select></div>
        <div><Label className="mb-2 block">Linked application</Label><Select value={linkedApplicationId} onValueChange={setLinkedApplicationId}><SelectTrigger aria-label="Linked application"><SelectValue placeholder="Choose an application" /></SelectTrigger><SelectContent><SelectItem value="none">No linked application</SelectItem>{applications.map(application => <SelectItem key={application.id} value={application.id}>{application.goal === 'BUY' ? 'Purchase' : 'Refinance'} · {application.continuation?.selectedQuote.lenderName} · {new Date(application.createdAt).toLocaleDateString('en-AU')}</SelectItem>)}</SelectContent></Select><p className="mt-2 text-xs text-slate-500">Proceeding requires a continued loan application belonging to this customer.{applications.length === 0 && ' No continued applications are available yet.'}</p>{enquiry.linkedApplicationId && <Link href={`/admin/applications/${enquiry.linkedApplicationId}`} className="mt-2 inline-block text-sm font-semibold text-primary underline">View linked application</Link>}</div>
        <div className="border-t pt-5"><Label className="mb-2 block">Record a contact attempt (optional)</Label><Select value={channel} onValueChange={value => { setChannel(value); if (value === 'none') setOutcome('none'); }}><SelectTrigger aria-label="Contact channel"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No contact attempt</SelectItem>{CONTACT_CHANNELS.map(value => <SelectItem key={value} value={value}>{pretty(value)}</SelectItem>)}</SelectContent></Select></div>
        {channel !== 'none' && <div><Label className="mb-2 block">Contact result</Label><Select value={outcome} onValueChange={setOutcome}><SelectTrigger aria-label="Contact result"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Choose a result</SelectItem>{CONTACT_OUTCOMES.map(value => <SelectItem key={value} value={value}>{pretty(value)}</SelectItem>)}</SelectContent></Select></div>}
        <div><Label htmlFor="activity-note" className="mb-2 block">Activity note (optional)</Label><textarea id="activity-note" maxLength={2000} rows={3} value={note} onChange={event => setNote(event.target.value)} className="w-full rounded-xl border p-3 text-sm" placeholder="Record useful context for your team" /></div>
        <Button type="submit" className="w-full gap-2" disabled={saving}>{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Saving…' : 'Save update'}</Button>
      </fieldset></form>
      <section className="rounded-2xl border bg-white p-6"><h2 className="text-xl font-bold">Activity history</h2><p className="mt-2 text-xs text-slate-500">Latest 100 records, newest first.</p><ol className="mt-5 space-y-4">{enquiry.activities.map(activity => <li key={activity.id} className="rounded-xl bg-slate-50 p-4 text-sm"><p className="font-semibold text-slate-900">{pretty(activity.type)}{activity.channel && ` · ${pretty(activity.channel)}`}{activity.outcome && ` · ${pretty(activity.outcome)}`}</p>{activity.toStatus && <p className="mt-1 text-slate-700">{activity.fromStatus ? `${ENQUIRY_STATUS_LABELS[activity.fromStatus]} → ` : ''}{ENQUIRY_STATUS_LABELS[activity.toStatus]}</p>}{activity.note && <p className="mt-2 whitespace-pre-wrap break-words text-slate-600">{activity.note}</p>}<p className="mt-2 text-xs text-slate-500">{new Date(activity.createdAt).toLocaleString('en-AU')} · {activity.actor?.fullName ?? activity.actor?.email ?? 'Customer / system'}</p></li>)}</ol></section></div>
    </>}
  </main>;
}
