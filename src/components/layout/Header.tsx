import Link from 'next/link';
import { PhoneCall, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
            S
          </div>
          <span className="text-xl font-extrabold tracking-tight text-slate-900">
            Smart<span className="text-primary">Loan</span>Selector
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="hidden sm:flex gap-2 rounded-full border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary">
            <PhoneCall className="h-4 w-4" />
            Talk to a Broker
          </Button>

          <Button variant="secondary" size="sm" className="rounded-full gap-2">
            <User className="h-4 w-4" />
            Login
          </Button>
        </div>
      </div>
    </header>
  );
}