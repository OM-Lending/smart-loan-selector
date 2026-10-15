'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, ExternalLink, FileUp, LoaderCircle, Save, Trash2 } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Details = Record<string, unknown>;
type UploadedDocument = { id: string; category: string; fileName: string; contentType: string; sizeBytes: number; uploadedAt: string };
type SelectedQuote = { id: string; lenderName: string; productName: string; rate: string; rateType: string; repayment: string };
type Field = { path: string; label: string; type?: 'date' | 'number' | 'positiveInteger' | 'textarea' | 'select'; required?: boolean; placeholder?: string; options?: { value: string; label: string }[] };
type Section = { title: string; note?: string; fields: Field[] };
const controlClass = 'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-slate-100';
const localDateKey = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };

const relationshipOptions = [{ value: 'SINGLE', label: 'Single' }, { value: 'MARRIED_DE_FACTO', label: 'Married or De facto' }];
const employmentOptions = [
  { value: 'FULL_TIME', label: 'Full-time' }, { value: 'PART_TIME', label: 'Part-time' },
  { value: 'CASUAL', label: 'Casual' }, { value: 'SELF_EMPLOYED', label: 'Self-employed' },
];

const sections: Section[] = [
  { title: 'Applicant 1', note: 'Some details are pre-filled from your profile. Add the information needed to prepare a lender application.', fields: [
    { path: 'applicant.fullName', label: 'Full name', required: true }, { path: 'applicant.dateOfBirth', label: 'Date of birth', type: 'date', required: true },
    { path: 'applicant.mobile', label: 'Mobile number', required: true }, { path: 'applicant.email', label: 'Email address', required: true }, { path: 'applicant.visaStatus', label: 'Visa or residency status', required: true },
    { path: 'applicant.maritalStatus', label: 'Marital status', type: 'select', required: true, options: relationshipOptions },
    { path: 'applicant.governmentBenefits', label: 'Centrelink / government benefits' }, { path: 'applicant.residentialAddress', label: 'Current home address', required: true },
    { path: 'applicant.residentialSince', label: 'Date you moved into your current home', type: 'date', required: true }, { path: 'applicant.housingArrangement', label: 'Current housing', placeholder: 'Renting, mortgage, living with parents, or fully paid' },
  ] },
  { title: 'Applicant 2 (if applicable)', fields: [
    { path: 'applicant2.fullName', label: 'Full name' }, { path: 'applicant2.dateOfBirth', label: 'Date of birth', type: 'date' }, { path: 'applicant2.visaStatus', label: 'Visa or residency status' },
    { path: 'applicant2.maritalStatus', label: 'Marital status', type: 'select', options: relationshipOptions }, { path: 'applicant2.employmentStatus', label: 'Employment type', type: 'select', options: employmentOptions }, { path: 'applicant2.annualIncome', label: 'Annual income (AUD)', type: 'positiveInteger' },
  ] },
  { title: 'Current employment', fields: [
    { path: 'currentEmployment.annualIncome', label: 'Annual income before tax (AUD)', type: 'positiveInteger', required: true }, { path: 'currentEmployment.employmentType', label: 'Employment type', type: 'select', required: true, options: employmentOptions },
    { path: 'currentEmployment.employerName', label: 'Employer name / ABN', required: true }, { path: 'currentEmployment.position', label: 'Position / occupation', required: true },
    { path: 'currentEmployment.officePhone', label: 'Office phone' }, { path: 'currentEmployment.officeAddress', label: 'Workplace address' },
    { path: 'currentEmployment.employerContactName', label: 'Employer contact name', required: true }, { path: 'currentEmployment.employerContactPhone', label: 'Employer contact phone', required: true }, { path: 'currentEmployment.employerContactPosition', label: 'Employer contact position', required: true },
    { path: 'currentEmployment.startDate', label: 'Employment start date', type: 'date', required: true }, { path: 'currentEmployment.salaryBank', label: 'Bank where salary is paid' },
    { path: 'previousEmployment.history', label: 'Previous 3 years employment history (if current job is less than 3 years)', type: 'textarea', placeholder: 'Employer/ABN, position, contact details, address, start and end dates' },
  ] },
  { title: 'Assets and liabilities', fields: [
    { path: 'assetsAndLiabilities.savings', label: 'Savings (bank and balance)', required: true, placeholder: 'Enter None if not applicable' }, { path: 'assetsAndLiabilities.homeContents', label: 'Home contents (estimated value)' }, { path: 'assetsAndLiabilities.shares', label: 'Shares (estimated value)' },
    { path: 'assetsAndLiabilities.superannuation', label: 'Superannuation fund and balance' }, { path: 'assetsAndLiabilities.cars', label: 'Cars (model, year and estimated value)' }, { path: 'assetsAndLiabilities.carLoans', label: 'Car loans (lender and balance)' },
    { path: 'assetsAndLiabilities.creditCards', label: 'Credit cards (lender and limit)', required: true, placeholder: 'Enter None if not applicable' }, { path: 'assetsAndLiabilities.studentLoan', label: 'Student loan balance' }, { path: 'assetsAndLiabilities.personalLoans', label: 'Personal loans (lender and balance)' },
    { path: 'assetsAndLiabilities.weeklyRent', label: 'Weekly rent expense (AUD)', type: 'number' }, { path: 'assetsAndLiabilities.privateHealthInsurance', label: 'Private health insurance details' },
  ] },
  { title: 'Property owned (if applicable)', note: 'List your home and up to three investment properties. You can enter each property’s details in one box.', fields: [
    { path: 'properties.ownerOccupied', label: 'Owner-occupied property', type: 'textarea', placeholder: 'Address; property type/bedrooms; ownership percentage; market value; weekly rent; lender; loan limit and balance; loan start date' },
    { path: 'properties.investment1', label: 'Investment property 1', type: 'textarea', placeholder: 'Address; property type/bedrooms; ownership percentage; market value; weekly rent; lender; loan limit and balance; loan start date' },
    { path: 'properties.investment2', label: 'Investment property 2', type: 'textarea', placeholder: 'Address; property type/bedrooms; ownership percentage; market value; weekly rent; lender; loan limit and balance; loan start date' },
    { path: 'properties.investment3', label: 'Investment property 3', type: 'textarea', placeholder: 'Address; property type/bedrooms; ownership percentage; market value; weekly rent; lender; loan limit and balance; loan start date' },
  ] },
  { title: 'Third-party contacts (if known)', fields: [
    { path: 'thirdParties.solicitor', label: 'Solicitor / conveyancer contact details', type: 'textarea', placeholder: 'Name, address, landline, mobile and email' }, { path: 'thirdParties.purchaseAgent', label: 'Purchase agent contact details', type: 'textarea', placeholder: 'Name, address, landline, mobile and email' },
  ] },
  { title: 'Loan requirements', note: 'You can include one or two loans and any product preferences you want your broker to know.', fields: [
    { path: 'loanRequirements.loan1', label: 'Loan 1 details', type: 'textarea', required: true, placeholder: 'Purchase or refinance; security address; valuation; preferred lender; loan amount; LVR' },
    { path: 'loanRequirements.loan2', label: 'Loan 2 details (if applicable)', type: 'textarea', placeholder: 'Purchase or refinance; security address; valuation; preferred lender; loan amount; LVR' },
    { path: 'loanRequirements.productPreferences', label: 'Product preferences', type: 'textarea', placeholder: 'Basic/package; fixed/variable; P&I/interest-only; offset; redraw; rate lock; split loan' },
  ] },
];

const documentTypes = [
  { id: 'identity', title: 'Identity', required: true, description: 'Passport or Australian driver licence. Include both sides if you use a driver licence.' },
  { id: 'income', title: 'Income evidence', required: true, description: 'Recent payslips; self-employed applicants can provide tax returns and financial statements.' },
  { id: 'bank_statements', title: 'Bank statements', description: 'Recent statements for salary, savings and accounts used for expenses or deposit.' },
  { id: 'liabilities', title: 'Loans and credit cards', description: 'Current statements showing lender, limit/balance and repayments.' },
  { id: 'property', title: 'Property documents', description: 'Contract of sale, rates notice or rental statement, if relevant.' },
  { id: 'refinance', title: 'Refinance documents', description: 'Current loan statement and payout details, if refinancing.' },
  { id: 'other', title: 'Other supporting material', description: 'Anything else you would like the broker to consider.' },
];

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
function cleanPositiveInteger(value: string) {
  return value.replace(/\D/g, '').replace(/^0+/, '');
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

  const save = useCallback(async (submit = false) => {
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/application/${id}/continuation`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quoteId: requestedQuoteId || undefined, details, submit }) });
      const body = await response.json() as { error?: string; missing?: string[]; validationErrors?: string[]; status?: string };
      if (response.status === 401) { router.replace(`/login?next=${encodeURIComponent(`/applications/${id}/continue${requestedQuoteId ? `?quote=${requestedQuoteId}` : ''}`)}`); return false; }
      if (!response.ok) throw new Error([body.error, body.missing?.length ? `Missing: ${body.missing.join(', ')}` : '', body.validationErrors?.join(' ')].filter(Boolean).join(' '));
      if (submit) { setSubmitted(true); setNotice('Your application information has been submitted.'); }
      else setNotice('Your progress has been saved. You can return and continue later.');
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
        const body = await response.json() as { error?: string; continuation?: { details: Details; selectedQuote: SelectedQuote; documents: UploadedDocument[]; status: string } | null; customer?: { fullName: string | null; email: string; phone: string | null }; knownAnswers?: { employmentStatus: string; employmentStartDate: string | null; annualIncome: string; maritalStatus: string } };
        if (!response.ok) throw new Error(body.error || 'Could not load application details.');
        let loadedDetails = body.continuation?.details ?? {};
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
          setSubmitted(body.continuation?.status === 'SUBMITTED');
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
    <header className="mt-5 rounded-2xl bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-bold uppercase tracking-widest text-primary">Continue your application</p><h1 className="mt-2 text-3xl font-extrabold text-slate-900">A few more details</h1><p className="mt-3 max-w-3xl leading-6 text-slate-600">These details help your broker prepare the lender application. You can save your progress and come back later. Supporting documents can be uploaded now or later.</p>
      {quote && <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="text-xs font-bold uppercase tracking-wide text-primary">Selected product</p><p className="mt-1 font-bold text-slate-900">{quote.lenderName} · {quote.productName}</p><p className="mt-1 text-sm text-slate-600">{quote.rate}% p.a. · {quote.rateType.replaceAll('_', ' ').toLowerCase()} · {quote.repayment.replaceAll('_', ' ').toLowerCase()}</p></div>}
    </header>
    {error && <div role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
    {notice && <div role="status" className="mt-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{notice}</div>}
    {submitted ? <section className="mt-6 rounded-2xl border border-emerald-200 bg-white p-8"><CheckCircle2 className="h-8 w-8 text-emerald-600"/><h2 className="mt-3 text-xl font-bold">Details received</h2><p className="mt-2 text-slate-600">Your broker can review the information and uploaded materials. You can open a file in a new tab or remove an incorrect upload until your application is submitted to a lender.</p><div className="mt-5 space-y-2">{documents.map(document => <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">{document.fileName}</span><span className="flex shrink-0 items-center gap-4"><a href={`/api/application/${id}/continuation/documents/${document.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">Review<ExternalLink className="h-4 w-4"/></a><button type="button" disabled={Boolean(removingDocument)} onClick={() => void removeDocument(document)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-700 hover:underline disabled:opacity-50">{removingDocument === document.id ? 'Removing…' : 'Remove'}<Trash2 className="h-4 w-4"/></button></span></div>)}</div></section> : <>
      <div className="mt-6 space-y-5">{sections.map(section => <section key={section.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="text-xl font-bold text-slate-900">{section.title}</h2>{section.note && <p className="mt-1 text-sm leading-6 text-slate-600">{section.note}</p>}<div className="mt-5 grid gap-4 sm:grid-cols-2">{section.fields.map(field => {
        const raw = getValue(details, field.path);
        const value = typeof raw === 'string' || typeof raw === 'number' ? String(raw) : '';
        return <label key={field.path} className={`block ${field.type === 'textarea' ? 'sm:col-span-2' : ''}`}><span className="text-sm font-semibold text-slate-700">{field.label}{field.required && <span className="ml-1 text-red-600">*</span>}</span>
          {field.type === 'textarea' ? <textarea value={value} onChange={event => setDetails(current => setValue(current, field.path, event.target.value))} placeholder={field.placeholder} rows={4} disabled={submitted} className={controlClass}/>
            : field.type === 'select' ? <Select value={value} onValueChange={nextValue => setDetails(current => setValue(current, field.path, nextValue))} disabled={submitted}><SelectTrigger aria-required={field.required}><SelectValue placeholder="Select an option" /></SelectTrigger><SelectContent>{field.options?.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
      : field.type === 'date' ? <DatePicker value={value} onChange={nextValue => setDetails(current => setValue(current, field.path, nextValue))} ariaLabel={field.label} maxDate={localDateKey()} disabled={submitted}/>
                : <input type={field.type === 'positiveInteger' ? 'text' : field.type === 'number' ? 'number' : 'text'} inputMode={field.type === 'positiveInteger' ? 'numeric' : undefined} pattern={field.type === 'positiveInteger' ? '[1-9][0-9]*' : undefined} min={field.type === 'number' ? '0' : undefined} step={field.type === 'number' ? 'any' : undefined} value={value} onChange={event => setDetails(current => setValue(current, field.path, field.type === 'positiveInteger' ? cleanPositiveInteger(event.target.value) : event.target.value))} placeholder={field.placeholder} required={field.required} disabled={submitted} className={controlClass}/>}</label>;
      })}</div>
      {section.title === 'Applicant 1' && <div className="mt-5 space-y-5 border-t border-slate-100 pt-5">
        <div><label className="text-sm font-semibold text-slate-700">Number of dependent children</label><div className="mt-1.5 max-w-xs"><Select value={String(getValue(details, 'applicant.dependents') || '0')} disabled={submitted} onValueChange={nextValue => { const count = Number(nextValue); setDetails(current => { const birthDates = Array.isArray(getValue(current, 'applicant.dependentBirthDates')) ? getValue(current, 'applicant.dependentBirthDates') as string[] : []; return setValue(setValue(current, 'applicant.dependents', String(count)), 'applicant.dependentBirthDates', Array.from({ length: count }, (_, index) => birthDates[index] ?? '')); }); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[0, 1, 2, 3, 4, 5].map(count => <SelectItem key={count} value={String(count)}>{count}</SelectItem>)}</SelectContent></Select></div>
          {Number(getValue(details, 'applicant.dependents') || 0) > 0 && <div className="mt-4 grid gap-4 sm:grid-cols-2">{(Array.isArray(getValue(details, 'applicant.dependentBirthDates')) ? getValue(details, 'applicant.dependentBirthDates') as string[] : []).map((birthDate, index) => <label key={index} className="text-sm font-semibold text-slate-700">Child {index + 1} date of birth<DatePicker value={birthDate} maxDate={localDateKey()} ariaLabel={`Child ${index + 1} date of birth`} disabled={submitted} onChange={nextValue => setDetails(current => { const dates = Array.isArray(getValue(current, 'applicant.dependentBirthDates')) ? [...getValue(current, 'applicant.dependentBirthDates') as string[]] : []; dates[index] = nextValue; return setValue(current, 'applicant.dependentBirthDates', dates); })}/></label>)}</div>}
        </div>
        {(() => { const since = String(getValue(details, 'applicant.residentialSince') || ''); if (!since) return null; const currentDate = new Date(`${since}T00:00:00`); const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 3); if (Number.isNaN(currentDate.getTime()) || currentDate <= cutoff) return null; const addresses = Array.isArray(getValue(details, 'applicant.previousAddresses')) ? getValue(details, 'applicant.previousAddresses') as { address: string; moveInDate: string; moveOutDate: string }[] : []; const updateAddress = (index: number, key: 'address' | 'moveInDate' | 'moveOutDate', value: string) => setDetails(current => { const rows = Array.isArray(getValue(current, 'applicant.previousAddresses')) ? [...getValue(current, 'applicant.previousAddresses') as { address: string; moveInDate: string; moveOutDate: string }[]] : []; const previous = rows[index] ?? {}; rows[index] = { address: previous.address ?? '', moveInDate: previous.moveInDate ?? '', moveOutDate: previous.moveOutDate ?? '', [key]: value }; return setValue(current, 'applicant.previousAddresses', rows); }); return <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4"><h3 className="font-semibold text-slate-900">Previous address history</h3><p className="mt-1 text-sm leading-5 text-slate-600">Your current address is less than 3 years old. Add as many previous addresses as needed to cover the full 3 years before you moved in.</p><div className="mt-4 space-y-4">{addresses.map((address, index) => <div key={index} className="grid gap-3 rounded-lg border border-amber-100 bg-white p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"><label className="text-xs font-semibold text-slate-600">Previous address<input required value={address.address} onChange={event => updateAddress(index, 'address', event.target.value)} disabled={submitted} className={controlClass}/></label><label className="text-xs font-semibold text-slate-600">Moved in<DatePicker value={address.moveInDate} ariaLabel={`Previous address ${index + 1} moved in date`} maxDate={localDateKey()} disabled={submitted} onChange={value => updateAddress(index, 'moveInDate', value)}/></label><label className="text-xs font-semibold text-slate-600">Moved out<DatePicker value={address.moveOutDate} ariaLabel={`Previous address ${index + 1} moved out date`} maxDate={localDateKey()} disabled={submitted} onChange={value => updateAddress(index, 'moveOutDate', value)}/></label><button type="button" disabled={submitted} onClick={() => setDetails(current => setValue(current, 'applicant.previousAddresses', addresses.filter((_, rowIndex) => rowIndex !== index)))} className="self-end rounded-lg px-3 py-3 text-sm font-semibold text-red-700 hover:bg-red-50">Remove</button></div>)}</div><button type="button" disabled={submitted} onClick={() => setDetails(current => setValue(current, 'applicant.previousAddresses', [...addresses, { address: '', moveInDate: '', moveOutDate: '' }]))} className="mt-3 rounded-full border border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5">Add previous address</button></div>; })()}
      </div>}
      </section>)}</div>
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="text-xl font-bold text-slate-900">Supporting documents</h2><p className="mt-1 text-sm leading-6 text-slate-600">Upload PDF, JPG or PNG files up to 10 MB each. Identity and income evidence are required before final submission. The other items can be provided later if they apply to you.</p><div className="mt-5 space-y-3">{documentTypes.map(item => { const attached = documents.filter(doc => doc.category === item.id); return <div key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="font-semibold text-slate-900">{item.title}{item.required && <span className="ml-2 text-xs font-bold text-red-700">Required</span>}</p><p className="mt-1 text-sm leading-5 text-slate-600">{item.description}</p>{attached.map(doc => <div key={doc.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2"><span className="flex min-w-0 items-center gap-1.5 truncate text-xs font-medium text-emerald-800"><CheckCircle2 className="h-3.5 w-3.5 shrink-0"/>{doc.fileName} · {(doc.sizeBytes / (1024 * 1024)).toFixed(1)} MB</span><span className="flex shrink-0 items-center gap-3"><a href={`/api/application/${id}/continuation/documents/${doc.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">Review<ExternalLink className="h-3.5 w-3.5"/></a><button type="button" disabled={Boolean(removingDocument)} onClick={() => void removeDocument(doc)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline disabled:opacity-50">{removingDocument === doc.id ? 'Removing…' : 'Remove'}<Trash2 className="h-3.5 w-3.5"/></button></span></div>)}</div><label className={`inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-primary hover:text-primary ${uploading === item.id ? 'pointer-events-none opacity-50' : ''}`}><FileUp className="h-4 w-4"/>{uploading === item.id ? 'Uploading…' : attached.length ? 'Add another' : 'Upload'}<input type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" disabled={submitted || Boolean(uploading)} onChange={event => { void upload(item.id, event.target.files?.[0]); event.currentTarget.value = ''; }}/></label></div></div>; })}</div></section>
      <div className="sticky bottom-0 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur"><p className="text-xs text-slate-500">You can save now and finish this later.</p><div className="flex flex-wrap gap-3"><button type="button" onClick={() => void save(false)} disabled={saving || Boolean(uploading)} className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Save className="h-4 w-4"/>{saving ? 'Saving…' : 'Submit later'}</button><button type="button" onClick={() => void save(true)} disabled={saving || Boolean(uploading)} className="rounded-full bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-50">{saving ? 'Submitting…' : 'Submit application details'}</button></div></div>
    </>}
  </div></main>;
}
