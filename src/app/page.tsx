import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="w-full">
      {/* Hero Section */}
      <section className="bg-slate-900 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            Compare Low Home Loan Rates Across Australia
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
            Find, compare, and match the best home loan rates.
          </p>
          
          <div className="mt-8 flex justify-center gap-4">
            <a
              href="#calculator"
              className="rounded-full bg-emerald-600 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-emerald-500"
            >
              Start Rate Match
            </a>
          </div>
        </div>
      </section>

      {/* Placeholder Content Area */}
      <section id="calculator" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div>
          <p className="text-lg font-bold text-slate-700">Placeholder</p>
        </div>
      </section>
    </div>
  );
}