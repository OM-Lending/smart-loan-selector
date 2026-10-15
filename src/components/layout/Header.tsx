'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PhoneCall, UserRound, ChevronDown, LogOut, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useClerk, useUser } from '@clerk/nextjs';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [roleState, setRoleState] = useState<{ userId: string; role: string | null } | null>(null);
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const email = user?.primaryEmailAddress?.emailAddress;
  const name = user?.fullName || user?.firstName || email;
  const avatar = user?.imageUrl;
  const isAdmin = Boolean(user && roleState?.userId === user.id && roleState.role === 'ADMIN');

  useEffect(() => {
    if (!isLoaded || !user) return;
    let active = true;
    void (async () => {
      try {
        const response = await fetch('/api/account/role', { cache: 'no-store' });
        if (!response.ok) return;
        const body = await response.json() as { role?: string | null };
        if (active) setRoleState({ userId: user.id, role: body.role ?? null });
      } catch {
        // The menu is navigation only; server-side authorization remains authoritative.
      }
    })();
    return () => { active = false; };
  }, [isLoaded, user]);

  const initials = (name || 'U').trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.jpg" alt="Smart Loan Selector Logo" width={140} height={100} className="object-contain" priority />
          <span className="text-xl font-extrabold tracking-tight text-slate-900"><span className="text-primary">Open</span>Lending</span>
        </Link>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="hidden gap-2 rounded-full border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary sm:flex">
            <PhoneCall className="h-4 w-4" /> Talk to a Broker
          </Button>
          {isLoaded && user ? (
            <div className="relative">
              <button type="button" aria-label="Open account menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1 pr-3 shadow-sm hover:border-primary/40">
                {avatar ? <Image src={avatar} alt="" width={34} height={34} className="h-[34px] w-[34px] rounded-full object-cover" unoptimized /> : <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{initials}</span>}
                <span className="hidden max-w-32 truncate text-sm font-semibold text-slate-700 sm:block">{name || 'Account'}</span>
                <ChevronDown className="h-4 w-4 text-slate-500" />
              </button>
              {menuOpen && <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                <div className="border-b px-3 py-2"><p className="truncate text-sm font-semibold text-slate-900">{name || 'Your account'}</p><p className="truncate text-xs text-slate-500">{email}</p></div>
                {isAdmin ? <>
                  <Link href="/admin/dashboard" onClick={() => setMenuOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><ShieldCheck className="h-4 w-4" /> Admin dashboard</Link>
                  <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><LayoutDashboard className="h-4 w-4" /> Customer dashboard</Link>
                </> : <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><LayoutDashboard className="h-4 w-4" /> Dashboard</Link>}
                <button type="button" onClick={async () => { setMenuOpen(false); await signOut(() => router.push('/')); router.refresh(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"><LogOut className="h-4 w-4" /> Sign out</button>
              </div>}
            </div>
          ) : isLoaded ? (
            <Link href="/login"><Button variant="secondary" size="sm" className="gap-2 rounded-full"><UserRound className="h-4 w-4" /> Login</Button></Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
