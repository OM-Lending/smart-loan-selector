'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { EmailOtpForm } from '@/components/auth/EmailOtpForm';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const destination = useMemo(() => next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard', [next]);
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4"><section className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 shadow-xl sm:p-10">
    <h1 className="text-2xl font-bold text-slate-900">Log in to your account</h1>
    <p className="mb-7 mt-2 text-sm text-slate-600">Enter the email address associated with your account. We’ll send you a one-time sign-in code.</p>
    <EmailOtpForm createUser={false} onVerified={() => { router.replace(destination); router.refresh(); }} />
    <p className="mt-6 text-center text-sm text-slate-500">New here? <Link href="/get-started" className="font-semibold text-primary hover:underline">Start an application</Link></p>
  </section></main>;
}

export default function LoginPage() {
  return <Suspense fallback={<main className="flex min-h-screen items-center justify-center">Loading…</main>}><LoginContent /></Suspense>;
}
