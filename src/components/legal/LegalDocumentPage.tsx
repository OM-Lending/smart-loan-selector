import Link from 'next/link';
import type { LegalDocument } from '@/lib/legal/documents';
import { LEGAL_ABN, LEGAL_ENTITY, PRIVACY_EMAIL } from '@/lib/legal/consent';

export function LegalDocumentPage({ document }: { document: LegalDocument }) {
  return <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
    <header className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-widest text-primary">OpenLending</p><h1 className="mt-2 text-3xl font-bold text-slate-900">{document.title}</h1><p className="mt-3 text-sm text-slate-600">{LEGAL_ENTITY} · ABN {LEGAL_ABN}</p><p className="mt-1 text-xs text-slate-500">Effective {document.effectiveDate} · Version {document.version}</p><nav aria-label="Legal documents" className="mt-5 flex flex-wrap gap-5 text-sm font-semibold text-primary"><Link href="/terms">Terms of Use</Link><Link href="/privacy">Privacy Policy</Link><Link href="/collection-notice">Collection Notice</Link></nav></header>
    <nav aria-label="On this page" className="mt-6 rounded-xl bg-primary/5 p-5"><h2 className="font-semibold">On this page</h2><ul className="mt-2 space-y-1 text-sm">{document.sections.map((section, index) => <li key={section.heading}><a href={`#section-${index + 1}`} className="text-primary underline underline-offset-2">{section.heading}</a></li>)}</ul></nav>
    <div className="mt-6 space-y-5">{document.sections.map((section, index) => <section key={section.heading} id={`section-${index + 1}`} className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold text-slate-900">{section.heading}</h2>{section.paragraphs.map(paragraph => <p key={paragraph} className="mt-3 text-sm leading-7 text-slate-700">{paragraph}</p>)}</section>)}</div>
    <p className="mt-6 text-sm text-slate-600">Privacy contact: <a className="font-semibold text-primary underline" href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a></p>
  </article>;
}
