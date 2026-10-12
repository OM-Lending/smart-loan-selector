'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        let id = localStorage.getItem('application_id');
        if (!id) {
          const response = await fetch('/api/application/latest');
          if (!response.ok) throw new Error('No application found');
          const latest = await response.json() as { applicationId: string };
          id = latest.applicationId;
          localStorage.setItem('application_id', id);
        }
        if (active) router.replace(`/applications/${id}/recommendations`);
      } catch {
        if (active) router.replace('/get-started');
      }
    })();
    return () => { active = false; };
  }, [router]);

  return <main className="flex min-h-[50vh] items-center justify-center p-6 text-slate-600">Loading your account…</main>;
}
