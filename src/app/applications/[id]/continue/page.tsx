'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, FileUp, LoaderCircle, Save, Trash2 } from 'lucide-react';
import { AddressInput } from '@/components/form/AddressInput';
import { CurrencyInput } from '@/components/ui/currency-input';
import { type AddressSelection } from '@/lib/validations/address';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { APPLICATION_DOCUMENT_TYPES, applicationDocumentTitle } from '@/lib/application-documents';
import { CONTINUATION_SECTIONS as sections, editableContinuationDetails } from '@/lib/continuation-form';
import { OwnedPropertiesForm } from '@/components/application/OwnedPropertiesForm';

type Details = Record<string, unknown>;
type UploadedDocument = { id: string; category: string; fileName: string; contentType: string; sizeBytes: number; uploadedAt: string };
type SelectedQuote = { id: string; lenderName: string; productName: string; rate: string; rateType: string; repayment: string };
const controlClass = 'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-slate-100';
const localDateKey = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };

function getValue(details: Details, path: string) {
  return path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, details) ?? '';
}
function setValue(details: Details, path: string, value: unknown): Details {
  const keys = path.split('.');
  const root = structuredClone(details);
  let cursor = root;
  for (const key of keys.slice(0, -1)) {
    const child = cursor[key];
    cursor[key] = child && typeof child === 'object' && !Array.isArray(child) ? child : {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[keys[keys.length - 1]] = value;
  return root;
}

export default function ContinueApplicationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedQuoteId = searchParams.get('quote');
  const [details, setDetails] = useState<Details>({});
  const [quote, setQuote] = useState<SelectedQuote | null>(null);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState('');
  const [removingDocument, setRemovingDocument] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [reviewStatus, setReviewStatus] = useState('NEW');
  const [brokerNote, setBrokerNote] = useState('');

  const save = useCallback(async (submit = false) => {
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/application/${id}/continuation`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quoteId: requestedQuoteId || undefined, details, submit }) });
      const body = await response.json() as { error?: string; missing?: string[]; validationErrors?: string[]; status?: string; reviewStatus?: string };
      if (response.status === 401) { router.replace(`/login?next=${encodeURIComponent(`/applications/${id}/continue${requestedQuoteId ? `?quote=${requestedQuoteId}` : ''}`)}`); return false; }
      if (!response.ok) throw new Error([body.error, body.missing?.length ? `Missing: ${body.missing.join(', ')}` : '', body.validationErrors?.join(' ')].filter(Boolean).join(' '));
      setReviewStatus(body.reviewStatus ?? 'NEW');
      setBrokerNote('');
      if (submit) { setSubmitted(true); setNotice('Your application has been submitted for broker review.'); }
      else { setSubmitted(false); setNotice('Your progress has been saved. You can return and continue later.'); }
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your application details.'); return false; }
    finally { setSaving(false); }
  }, [details, id, requestedQuoteId, router]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(`/api/application/${id}/continuation`, { cache: 'no-store' });
        if (response.status === 401) { router.replace(`/login?next=${encodeURIComponent(`/applications/${id}/continue`)}`); return; }
        const body = await response.json() as { error?: string; continuation?: { details: Details; selectedQuote: SelectedQuote; documents: UploadedDocument[]; status: string; reviewStatus: string; brokerNote: string | null } | null; customer?: { fullName: string | null; email: string; phone: string | null }; knownAnswers?: { employmentStatus: string; employmentStartDate: string | null; annualIncome: string; maritalStatus: string } };
        if (!response.ok) throw new Error(body.error || 'Could not load application details.');
        let loadedDetails = body.continuation?.details ?? {};
        if (body.continuation?.status !== 'SUBMITTED' || body.continuation?.reviewStatus === 'NEEDS_INFORMATION') loadedDetails = editableContinuationDetails(loadedDetails, true);
        if (body.customer) {
          const fullName = body.customer.fullName?.trim() ?? '';
          if (!getValue(loadedDetails, 'applicant.fullName')) loadedDetails = setValue(loadedDetails, 'applicant.fullName', fullName);
          if (!getValue(loadedDetails, 'applicant.email')) loadedDetails = setValue(loadedDetails, 'applicant.email', body.customer.email);
          if (!getValue(loadedDetails, 'applicant.mobile')) loadedDetails = setValue(loadedDetails, 'applicant.mobile', body.customer.phone ?? '');
        }
        if (body.knownAnswers) {
          if (!getValue(loadedDetails, 'applicant.maritalStatus')) loadedDetails = setValue(loadedDetails, 'applicant.maritalStatus', body.knownAnswers.maritalStatus);
          if (!getValue(loadedDetails, 'currentEmployment.employmentType')) loadedDetails = setValue(loadedDetails, 'currentEmployment.employmentType', body.knownAnswers.employmentStatus);
          if (!getValue(loadedDetails, 'currentEmployment.annualIncome')) loadedDetails = setValue(loadedDetails, 'currentEmployment.annualIncome', body.knownAnswers.annualIncome.replace(/\.0+$/, ''));
          if (!getValue(loadedDetails, 'currentEmployment.startDate') && body.knownAnswers.employmentStartDate) {
            const match = /^(0[1-9]|1[0-2])\/(\d{4})$/.exec(body.knownAnswers.employmentStartDate);
            if (match) loadedDetails = setValue(loadedDetails, 'currentEmployment.startDate', `${match[2]}-${match[1]}-01`);
          }
        }
        if (active) {
          setDetails(loadedDetails);
          setQuote(body.continuation?.selectedQuote ?? null);
          setDocuments(body.continuation?.documents ?? []);
          setReviewStatus(body.continuation?.reviewStatus ?? 'NEW');
          setBrokerNote(body.continuation?.brokerNote ?? '');
          setSubmitted(body.continuation?.status === 'SUBMITTED' && body.continuation.reviewStatus !== 'NEEDS_INFORMATION');
          if (body.continuation && requestedQuoteId && body.continuation.selectedQuote.id !== requestedQuoteId) {
            const changed = await fetch(`/api/application/${id}/continuation`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quoteId: requestedQuoteId, details: loadedDetails }) });
            const changedBody = await changed.json() as { error?: string; selectedQuote?: SelectedQuote };
            if (!changed.ok) throw new Error(changedBody.error || 'Could not switch the selected product.');
            if (active) setQuote(changedBody.selectedQuote ?? null);
          }
          if (requestedQuoteId && !body.continuation) {
            const init = await fetch(`/api/application/${id}/continuation`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quoteId: requestedQuoteId, details: loadedDetails }) });
            const initBody = await init.json() as { error?: string; selectedQuote?: SelectedQuote };
            if (!init.ok) throw new Error(initBody.error || 'Could not start this application.');
            if (active) setQuote(initBody.selectedQuote ?? null);
          }
        }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Could not load application details.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [id, requestedQuoteId, router]);

  async function upload(category: string, file?: File) {
    if (!file) return;
    setUploading(category); setError(''); setNotice('');
    try {
      const form = new FormData(); form.set('category', category); form.set('file', file);
      const response = await fetch(`/api/application/${id}/continuation/documents`, { method: 'POST', body: form });
      const body = await response.json() as { error?: string; document?: UploadedDocument };
      if (!response.ok || !body.document) throw new Error(body.error || 'Could not upload this document.');
      setDocuments(current => [body.document!, ...current]);
      setNotice(`${body.document.fileName} uploaded securely.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not upload this document.'); }
    finally { setUploading(''); }
  }

  async function removeDocument(document: UploadedDocument) {
    if (!window.confirm(`Remove ${document.fileName}? This deletes the uploaded file.`)) return;
    setRemovingDocument(document.id); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/application/${id}/continuation/documents/${document.id}`, { method: 'DELETE' });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || 'Could not remove this document.');
      setDocuments(current => current.filter(item => item.id !== document.id));
      setNotice(`${document.fileName} was removed.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not remove this document.'); }
    finally { setRemovingDocument(''); }
  }

  if (loading) return <main className="flex min-h-[70vh] items-center justify-center text-slate-600"><LoaderCircle className="mr-2 h-5 w-5 animate-spin" />Loading your application…</main>;
  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8"><div className="mx-auto max-w-4xl">
    <Link href={`/applications/${id}/recommendations`} className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft className="h-4 w-4" />Back to recommendations</Link>
    <header className="mt-5 rounded-2xl bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-bold uppercase tracking-widest text-primary">{submitted ? 'Application received' : 'Continue your application'}</p><h1 className="mt-2 text-3xl font-extrabold text-slate-900">{submitted ? 'Your application is under review' : 'A few more details'}</h1><p className="mt-3 max-w-3xl leading-6 text-slate-600">{submitted ? 'Your submitted application is saved. Check its status or review the information you provided.' : 'All fields and uploads are optional. Provide what you can to help your broker prepare the lender application. You can save your progress and come back later.'}</p>
      {quote && <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="text-xs font-bold uppercase tracking-wide text-primary">Selected product</p><p className="mt-1 font-bold text-slate-900">{quote.lenderName} · {quote.productName}</p><p className="mt-1 text-sm text-slate-600">{quote.rate}% p.a. · {quote.rateType.replaceAll('_', ' ').toLowerCase()} · {quote.repayment.replaceAll('_', ' ').toLowerCase()}</p></div>}
    </header>
    {error && <div role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
    {notice && <div role="status" className="mt-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{notice}</div>}
    {reviewStatus === 'NEEDS_INFORMATION' && brokerNote && <section className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><h2 className="font-bold text-amber-950">Your broker needs a little more information</h2><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-amber-900">{brokerNote}</p><p className="mt-2 text-sm text-amber-900">Update the details or documents below, then submit them again for review.</p></section>}
    {submitted ? <section className="mt-6 rounded-2xl border border-emerald-200 bg-white p-8"><CheckCircle2 className="h-8 w-8 text-emerald-600"/><h2 className="mt-3 text-xl font-bold">Application submitted</h2><p className="mt-2 text-slate-600">Your application and any documents you uploaded have been received. A broker will review the information and contact you using the details you provided. If anything else is needed, your broker will let you know.</p><div className="mt-4 rounded-xl bg-emerald-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Current status</p><p className="mt-1 font-semibold text-emerald-950">{reviewStatus === 'IN_REVIEW' ? 'A broker is reviewing your application' : reviewStatus === 'READY_TO_SUBMIT' ? 'Your application is ready for the next step' : 'Waiting for broker review'}</p>{brokerNote && <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-900">{brokerNote}</p>}</div><Link href={`/applications/${id}/details`} className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary/90">View submitted application<ArrowRight className="h-4 w-4"/></Link></section> : <>
      <div className="mt-6 space-y-5">{sections.map(section => <section key={section.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="text-xl font-bold text-slate-900">{section.title}</h2>{section.note && <p className="mt-1 text-sm leading-6 text-slate-600">{section.note}</p>}<div className="mt-5 grid gap-4 sm:grid-cols-2">{section.fields.map(field => {
        const raw = getValue(details, field.path);
        const value = typeof raw === 'string' || typeof raw === 'number' ? String(raw) : '';
        if (field.type === 'address') return <div key={field.path}><p className="text-sm font-semibold text-slate-700">{field.label}</p><AddressInput value={value} selection={getValue(details, `${field.path}Selection`)} label={field.label} disabled={submitted} className={controlClass} onChange={(address, selection) => setDetails(current => setValue(setValue(current, field.path, address), `${field.path}Selection`, selection))} /></div>;
        return <label key={field.path} className={`block ${field.type === 'textarea' ? 'sm:col-span-2' : ''}`}><span className="text-sm font-semibold text-slate-700">{field.label}</span>
          {field.type === 'textarea' ? <textarea value={value} onChange={event => setDetails(current => setValue(current, field.path, event.target.value))} placeholder={field.placeholder} rows={4} disabled={submitted} className={controlClass}/>
            : field.type === 'select' ? <Select value={value} onValueChange={nextValue => setDetails(current => setValue(current, field.path, nextValue === '__CLEAR__' ? '' : nextValue))} disabled={submitted}><SelectTrigger aria-required={false}><SelectValue placeholder="Select an option (optional)" /></SelectTrigger><SelectContent><SelectItem value="__CLEAR__">Not provided</SelectItem>{[...(field.options ?? []), ...(field.path.endsWith('.maritalStatus') && submitted && value === 'MARRIED_DE_FACTO' ? [{ value: 'MARRIED_DE_FACTO', label: 'Married or De facto (saved earlier)' }] : [])].map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
      : field.type === 'date' ? <DatePicker allowClear value={value} onChange={nextValue => setDetails(current => setValue(current, field.path, nextValue))} ariaLabel={field.label} maxDate={localDateKey()} disabled={submitted}/>
                : field.type === 'positiveInteger' || field.type === 'number' ? <CurrencyInput value={value} fractionDigits={field.type === 'positiveInteger' ? 0 : 2} onValueChange={nextValue => setDetails(current => setValue(current, field.path, field.type === 'positiveInteger' && nextValue === '0' ? '' : nextValue))} aria-label={field.label} placeholder={field.placeholder} required={false} disabled={submitted} className={controlClass}/>
                : <input type="text" value={value} onChange={event => setDetails(current => setValue(current, field.path, event.target.value))} placeholder={field.placeholder} required={false} disabled={submitted} className={controlClass}/>}</label>;
      })}</div>
      {section.title === 'Applicant 1' && <div className="mt-5 space-y-5 border-t border-slate-100 pt-5">
        <div><label className="text-sm font-semibold text-slate-700">Number of dependent children</label><div className="mt-1.5 max-w-xs"><Select value={String(getValue(details, 'applicant.dependents') || '0')} disabled={submitted} onValueChange={nextValue => setDetails(current => setValue(current, 'applicant.dependents', nextValue))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[0, 1, 2, 3, 4, 5].map(count => <SelectItem key={count} value={String(count)}>{count}</SelectItem>)}</SelectContent></Select></div>
        </div>
        {(() => { const since = String(getValue(details, 'applicant.residentialSince') || ''); if (!since) return null; const currentDate = new Date(`${since}T00:00:00`); const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 3); if (Number.isNaN(currentDate.getTime()) || currentDate <= cutoff) return null; const addresses = Array.isArray(getValue(details, 'applicant.previousAddresses')) ? getValue(details, 'applicant.previousAddresses') as { address: string; moveInDate: string; moveOutDate: string; selection?: AddressSelection }[] : []; const updateAddress = (index: number, key: 'address' | 'moveInDate' | 'moveOutDate' | 'selection', value: string | AddressSelection | undefined) => setDetails(current => { const rows = Array.isArray(getValue(current, 'applicant.previousAddresses')) ? [...getValue(current, 'applicant.previousAddresses') as { address: string; moveInDate: string; moveOutDate: string; selection?: AddressSelection }[]] : []; const previous = rows[index] ?? {}; rows[index] = { address: previous.address ?? '', moveInDate: previous.moveInDate ?? '', moveOutDate: previous.moveOutDate ?? '', [key]: value }; return setValue(current, 'applicant.previousAddresses', rows); }); return <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4"><h3 className="font-semibold text-slate-900">Previous address history</h3><p className="mt-1 text-sm leading-5 text-slate-600">If available, add previous addresses to help your broker understand your address history. You can leave these blank.</p><div className="mt-4 space-y-4">{addresses.map((address, index) => <div key={index} className="grid gap-3 rounded-lg border border-amber-100 bg-white p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"><div className="text-xs font-semibold text-slate-600">Previous address<AddressInput value={address.address} selection={address.selection} label={`Previous address ${index + 1}`} onChange={(value, selection) => { updateAddress(index, 'address', value); updateAddress(index, 'selection', selection); }} disabled={submitted} className={controlClass}/></div><label className="text-xs font-semibold text-slate-600">Moved in<DatePicker allowClear value={address.moveInDate} ariaLabel={`Previous address ${index + 1} moved in date`} maxDate={localDateKey()} disabled={submitted} onChange={value => updateAddress(index, 'moveInDate', value)}/></label><label className="text-xs font-semibold text-slate-600">Moved out<DatePicker allowClear value={address.moveOutDate} ariaLabel={`Previous address ${index + 1} moved out date`} maxDate={localDateKey()} disabled={submitted} onChange={value => updateAddress(index, 'moveOutDate', value)}/></label><button type="button" disabled={submitted} onClick={() => setDetails(current => setValue(current, 'applicant.previousAddresses', addresses.filter((_, rowIndex) => rowIndex !== index)))} className="self-end rounded-lg px-3 py-3 text-sm font-semibold text-red-700 hover:bg-red-50">Remove</button></div>)}</div><button type="button" disabled={submitted} onClick={() => setDetails(current => setValue(current, 'applicant.previousAddresses', [...addresses, { address: '', moveInDate: '', moveOutDate: '' }]))} className="mt-3 rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5">Add previous address</button></div>; })()}
      </div>}
      </section>)}</div>
      <OwnedPropertiesForm value={details.properties} disabled={submitted} onChange={value => setDetails(current => ({ ...current, properties: value }))} />
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="text-xl font-bold text-slate-900">Supporting documents</h2><p className="mt-1 text-sm leading-6 text-slate-600">Upload PDF, JPG or PNG files up to 10 MB each. All uploads are optional. Provide the documents that apply to you; your broker can discuss anything missing.</p><div className="mt-5 space-y-3">{[...APPLICATION_DOCUMENT_TYPES, ...Array.from(new Set(documents.map(doc => doc.category))).filter(category => !APPLICATION_DOCUMENT_TYPES.some(item => item.id === category)).map(id => ({ id, title: applicationDocumentTitle(id), description: 'Previously uploaded supporting documents.' }))].map(item => { const attached = documents.filter(doc => doc.category === item.id); return <div key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{item.title}</p><p className="mt-1 text-sm leading-5 text-slate-600">{item.description}</p>{attached.map(doc => <div key={doc.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2"><span className="flex min-w-0 items-center gap-1.5 truncate text-xs font-medium text-emerald-800"><CheckCircle2 className="h-3.5 w-3.5 shrink-0"/><span className="truncate"><span className="font-bold">{applicationDocumentTitle(doc.category)}:</span> {doc.fileName} · {(doc.sizeBytes / (1024 * 1024)).toFixed(1)} MB</span></span><span className="flex shrink-0 items-center gap-3"><a href={`/api/application/${id}/continuation/documents/${doc.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Review<ExternalLink className="h-3.5 w-3.5"/></a><button type="button" disabled={Boolean(removingDocument)} onClick={() => void removeDocument(doc)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline disabled:opacity-50">{removingDocument === doc.id ? 'Removing…' : 'Remove'}<Trash2 className="h-3.5 w-3.5"/></button></span></div>)}</div><label className={`inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-primary hover:text-primary ${uploading === item.id ? 'pointer-events-none opacity-50' : ''}`}><FileUp className="h-4 w-4"/>{uploading === item.id ? 'Uploading…' : attached.length ? 'Add another' : 'Upload'}<input type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" disabled={submitted || Boolean(uploading)} onChange={event => { void upload(item.id, event.target.files?.[0]); event.currentTarget.value = ''; }}/></label></div></div>; })}</div></section>
      <div className="sticky bottom-0 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur"><p className="text-xs text-slate-500">You can save now and finish this later.</p><div className="flex flex-wrap gap-3"><button type="button" onClick={() => void save(false)} disabled={saving || Boolean(uploading)} className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Save className="h-4 w-4"/>{saving ? 'Saving…' : 'Submit later'}</button><button type="button" onClick={() => void save(true)} disabled={saving || Boolean(uploading)} className="rounded-full bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50">{saving ? 'Submitting…' : 'Submit application details'}</button></div></div>
    </>}
  </div></main>;
}
