'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Zap, Sparkles } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();

  const handleStart = () => {
    // router to the questionnaire page
    router.push('/get-started');
  };

  return (
    <div className="w-full">
      <section className="relative overflow-hidden bg-slate-900 py-20 sm:py-32 text-white min-h-[calc(100vh-64px)] flex flex-col justify-center">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> 
            Powered by Australian Open Banking (CDR)
          </div>

          <h1 className="mx-auto max-w-4xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Compare Low Home Loan Rates <br className="hidden sm:inline" />
            <span className="text-primary">Across Australia</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
            Skip the broker delays and complex lender jargon. Discover real-time mortgage rates tailored to your deposit and borrowing profile in under 2 minutes.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" className="rounded-full px-8 text-base h-12" onClick={handleStart}>
              Start Rate Match
            </Button>
            <Button variant="ghost" size="lg" className="rounded-full text-slate-300 hover:text-white hover:bg-slate-800">
              How It Works ↓
            </Button>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 sm:gap-10">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>No Impact on Credit Score</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-primary" />
              <span>Direct Bank API Integration</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}