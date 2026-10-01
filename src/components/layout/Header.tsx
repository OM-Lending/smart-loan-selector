import Link from 'next/link';
import { PhoneCall, User } from 'lucide-react';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-lg font-bold text-white shadow-sm">
              logo
            </div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900">
              Smart<span className="text-emerald-600">Loan</span>Selector
            </span>
          </Link>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 sm:gap-4">
          <a
            href="tel:1300000000"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-600/30 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
          >
            <PhoneCall className="h-4 w-4" />
            <span className="hidden sm:inline">Talk to a Broker</span>
            <span className="sm:hidden">Call</span>
          </a>

          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <User className="h-4 w-4" />
            <span>Login</span>
          </Link>
        </div>
      </div>
    </header>
  );
}