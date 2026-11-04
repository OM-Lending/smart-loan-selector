'use client';

import { useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Dialog } from 'radix-ui';
import { CheckCircle2, LoaderCircle, PhoneCall, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BrokerEnquiryForm } from '@/lib/validations/broker-enquiry';

// getRandomValues also works on local HTTP/LAN origins where randomUUID may not.
function submissionId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const empty = { fullName: '', email: '', phone: '', message: '', website: '' };

export function BrokerEnquiryDialog() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const inFlight = useRef(false);
  const edited = useRef(false);
  const requestId = useRef('');
  const generation = useRef(0);

  const changeOpen = (next: boolean) => {
    if (inFlight.current) return;
    setOpen(next);
    generation.current++;
    if (!next) return;
    const version = generation.current;
    requestId.current = submissionId(); edited.current = false;
    setSuccess(false); setError(''); setErrors({});
    const metadataName = typeof user?.unsafeMetadata.full_name === 'string' ? user.unsafeMetadata.full_name : '';
    setValues({ ...empty, fullName: user?.fullName ?? metadataName, email: user?.primaryEmailAddress?.emailAddress ?? '', phone: user?.primaryPhoneNumber?.phoneNumber ?? '' });
    if (user) void fetch('/api/account/contact', { cache: 'no-store' }).then(async response => {
      if (!response.ok) return;
      const contact = await response.json() as { fullName: string; email: string; phone: string };
      if (!edited.current && generation.current === version) setValues({ ...empty, ...contact });
    }).catch(() => undefined);
  };
  const update = (key: keyof typeof empty, value: string) => {
    edited.current = true;
    // An edited message is a new submission, while retries keep the same ID.
    requestId.current = submissionId();
    setValues(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: undefined }));
  };
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    const parsed = BrokerEnquiryForm.safeParse(values);
    if (!parsed.success) { setErrors(parsed.error.flatten().fieldErrors); return; }
    inFlight.current = true; setSaving(true); setError('');
    try {
      const response = await fetch('/api/broker-enquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...parsed.data, website: values.website, requestId: requestId.current }) });
      const body = await response.json() as { success?: boolean; error?: string; details?: Record<string, string[]> };
      if (!response.ok || !body.success) { if (body.details) setErrors(body.details); throw new Error(body.error || 'Could not send your message. Please retry.'); }
      setSuccess(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not send your message. Please retry.'); }
    finally { inFlight.current = false; setSaving(false); }
  };

  return <Dialog.Root open={open} onOpenChange={changeOpen}>
    <Dialog.Trigger asChild><Button type="button" variant="outline" size="sm" aria-label="Talk to a broker" className="gap-2 rounded-full border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"><PhoneCall aria-hidden="true" className="h-4 w-4" /><span className="hidden sm:inline">Talk to a Broker</span></Button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[100] bg-slate-950/45 backdrop-blur-sm" />
      <Dialog.Content onPointerDownOutside={event => event.preventDefault()} onInteractOutside={event => event.preventDefault()} onEscapeKeyDown={event => { if (saving) event.preventDefault(); }} className="fixed left-1/2 top-1/2 z-[101] max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8" aria-busy={saving}>
        <Dialog.Close asChild><button type="button" aria-label="Close contact form" disabled={saving} className="absolute right-4 top-4 rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button></Dialog.Close>
        <Dialog.Title className="pr-8 text-2xl font-bold text-slate-900">Talk to a broker</Dialog.Title>
        <Dialog.Description className="mt-2 text-sm leading-6 text-slate-600">Leave your contact details and a message. Our team will contact you to discuss your home loan needs.</Dialog.Description>
        {success ? <div className="mt-6 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" /><p role="status" className="mt-4 font-semibold text-slate-900">Your message has been received.</p><p className="mt-2 text-sm text-slate-600">A broker will contact you.</p><Dialog.Close asChild><Button type="button" className="mt-6 w-full">Done</Button></Dialog.Close></div> : <form onSubmit={send} className="mt-6 space-y-4" noValidate>
          {(['fullName', 'email', 'phone'] as const).map(key => <div key={key}><Label htmlFor={`enquiry-${key}`} className="mb-2 block">{key === 'fullName' ? 'Full name' : key === 'email' ? 'Email address' : 'Phone number'}</Label><Input id={`enquiry-${key}`} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} autoComplete={key === 'fullName' ? 'name' : key === 'email' ? 'email' : 'tel'} maxLength={key === 'fullName' ? 120 : key === 'email' ? 254 : 24} value={values[key]} onChange={event => update(key, event.target.value)} disabled={saving} aria-required="true" aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `enquiry-${key}-error` : undefined} />{errors[key] && <p id={`enquiry-${key}-error`} className="mt-1 text-sm text-red-700">{errors[key]?.[0]}</p>}</div>)}
          <div><Label htmlFor="enquiry-message" className="mb-2 block">Message</Label><textarea id="enquiry-message" rows={4} maxLength={4000} value={values.message} onChange={event => update('message', event.target.value)} disabled={saving} aria-required="true" aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'enquiry-message-error' : undefined} className="w-full rounded-xl border border-input p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50" placeholder="How can we help?" />{errors.message && <p id="enquiry-message-error" className="mt-1 text-sm text-red-700">{errors.message[0]}</p>}</div>
          <div aria-hidden="true" className="hidden"><label htmlFor="enquiry-website">Website</label><input id="enquiry-website" tabIndex={-1} autoComplete="off" value={values.website} onChange={event => update('website', event.target.value)} /></div>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          <Button type="submit" disabled={saving} className="w-full gap-2">{saving && <LoaderCircle className="h-4 w-4 animate-spin" />}{saving ? 'Sending message…' : 'Send message'}</Button>
        </form>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
