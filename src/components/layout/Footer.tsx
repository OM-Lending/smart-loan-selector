import Link from 'next/link';
import { LEGAL_ENTITY, LEGAL_ABN } from '@/lib/legal/consent';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-slate-100 text-slate-600 text-xs leading-relaxed">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
        <div className="border-b border-slate-200 pb-8 text-slate-500">
          <p>
            We acknowledge the Traditional Owners of the many lands where we live and work and pay our respects to Elders past, present and emerging. We celebrate the stories, culture and traditions of Aboriginal and Torres Strait Islander Elders of all communities from the many lands where we live, work and gather.
          </p>
        </div>

        <div className="space-y-4 text-slate-500">
          <p className="font-semibold text-slate-700">
            © {currentYear} {LEGAL_ENTITY} · ABN {LEGAL_ABN} · All rights reserved.
          </p>
          <nav aria-label="Legal information" className="flex flex-wrap gap-5 text-sm font-semibold text-primary"><Link href="/terms" className="hover:underline">Terms of Use</Link><Link href="/privacy" className="hover:underline">Privacy Policy</Link><Link href="/collection-notice" className="hover:underline">Collection Notice</Link></nav>
          <p className="text-[11px] text-slate-400 max-w-4xl">
            Comparisons are preliminary estimates, not loan approval or a complete assessment of your borrowing capacity. Product information is sourced from public bank APIs and may change. A broker and the lender must verify your circumstances, eligibility and the terms available to you.
          </p>
        </div>
      </div>
    </footer>
  );
}