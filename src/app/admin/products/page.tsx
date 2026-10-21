'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, LoaderCircle, PackageSearch, Search } from 'lucide-react';

type Rate = { rateType: string; interestRate: string };
type Product = {
  id: string;
  externalId: string;
  productName: string;
  description: string | null;
  recommendationStatus: 'INCLUDED' | 'EXCLUDED';
  recommendationNote: string | null;
  recommendationSourceUri: string | null;
  recommendationReviewedAt: string | null;
  recommendationReviewer: { fullName: string | null; email: string } | null;
  applicationUri: string | null;
  overviewUri: string | null;
  lender: { name: string; logoUrl: string | null };
  rates: Rate[];
};
type ProductData = { products: Product[]; page: number; pageSize: number; total: number };

export default function AdminLoanProductsPage() {
  const [data, setData] = useState<ProductData | null>(null);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [refreshToken, setRefreshToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page), status });
    if (appliedQuery) params.set('q', appliedQuery);
    void (async () => {
      try {
        const response = await fetch(`/api/admin/products?${params}`, { cache: 'no-store' });
        const body = await response.json() as ProductData & { error?: string };
        if (!response.ok) throw new Error(body.error || 'Could not load loan products.');
        if (active) setData(body);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load loan products.');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [appliedQuery, page, refreshToken, status]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError('');
    setPage(1); setAppliedQuery(query.trim());
  }

  async function saveProduct(productId: string, values: { recommendationStatus: Product['recommendationStatus']; note: string; sourceUri: string }) {
    setNotice(''); setError('');
    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || 'Could not update this product.');
      setNotice('Recommendation setting saved.');
      setRefreshToken(value => value + 1);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this product.');
      return false;
    }
  }

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 25)));
  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft className="h-4 w-4"/>Admin dashboard</Link>
    <header className="mt-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-widest text-primary">Product data</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Loan products</h1><p className="mt-2 max-w-3xl text-slate-600">Review active mortgage products and choose which ones can appear in customer recommendations. Bank sync updates product data without changing your recommendation decision.</p></div><div className="rounded-xl bg-white px-4 py-3 text-sm text-slate-600 shadow-sm"><span className="font-bold text-slate-900">{data?.total ?? '—'}</span> active products</div></header>
    {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    <form onSubmit={search} className="mt-6 flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="relative min-w-[220px] flex-1"><span className="sr-only">Search products or banks</span><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search bank, product or CDR product ID" className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"/></label>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><span className="sr-only">Recommendation status</span><select value={status} onChange={event => { setLoading(true); setError(''); setStatus(event.target.value); setPage(1); }} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="ALL">All recommendation settings</option><option value="INCLUDED">Included</option><option value="EXCLUDED">Excluded</option></select></label>
      <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary/90"><Search className="h-4 w-4"/>Search</button>
    </form>

    {loading && <div className="flex min-h-40 items-center justify-center text-slate-500"><LoaderCircle className="mr-2 h-5 w-5 animate-spin"/>Loading products…</div>}
    {!loading && data && <>
      {data.products.length === 0 ? <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">No active loan products match this search.</div> : <section aria-label="Active loan products" className="mt-5 space-y-4">{data.products.map(product => <ProductCard key={product.id} product={product} onSave={saveProduct}/>)}</section>}
      <nav aria-label="Product pages" className="mt-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-600">Page {data.page} of {totalPages} · {data.total} products</p><div className="flex gap-2"><button type="button" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage(value => value - 1); }} className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-40"><ArrowLeft className="h-4 w-4"/>Previous</button><button type="button" disabled={page >= totalPages || loading} onClick={() => { setLoading(true); setPage(value => value + 1); }} className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-40">Next<ArrowRight className="h-4 w-4"/></button></div></nav>
    </>}
  </main>;
}

function ProductCard({ product, onSave }: { product: Product; onSave: (id: string, values: { recommendationStatus: Product['recommendationStatus']; note: string; sourceUri: string }) => Promise<boolean> }) {
  const [recommendationStatus, setRecommendationStatus] = useState(product.recommendationStatus);
  const [note, setNote] = useState(product.recommendationNote ?? '');
  const [sourceUri, setSourceUri] = useState(product.recommendationSourceUri ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const changed = recommendationStatus !== product.recommendationStatus || note !== (product.recommendationNote ?? '') || sourceUri !== (product.recommendationSourceUri ?? '');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('');
    const saved = await onSave(product.id, { recommendationStatus, note, sourceUri });
    if (!saved) setError('Please correct the error above and try again.');
    setSaving(false);
  }

  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><PackageSearch className="h-5 w-5"/></div><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{product.lender.name}</p><h2 className="mt-1 text-lg font-bold text-slate-900">{product.productName}</h2><p className="mt-1 break-all text-xs text-slate-500">CDR product ID: {product.externalId}</p></div></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${product.recommendationStatus === 'EXCLUDED' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>{product.recommendationStatus === 'EXCLUDED' ? 'Excluded from recommendations' : 'Included in recommendations'}</span></div>
    {product.description && <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-700">{product.description}</p>}
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">{product.rates.length > 0 && <p className="text-slate-600">Current rates: {product.rates.map(rate => `${rate.interestRate}% ${rate.rateType.toLowerCase()}`).join(' · ')}</p>}{product.applicationUri && <a href={product.applicationUri} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">Application page<ExternalLink className="h-3.5 w-3.5"/></a>}{product.overviewUri && <a href={product.overviewUri} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">Bank product page<ExternalLink className="h-3.5 w-3.5"/></a>}</div>
    <form onSubmit={submit} className="mt-5 grid gap-4 border-t border-slate-100 pt-5 md:grid-cols-2">
      <label className="block"><span className="text-sm font-semibold text-slate-700">Recommendation status</span><select value={recommendationStatus} onChange={event => setRecommendationStatus(event.target.value as Product['recommendationStatus'])} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="INCLUDED">Include in recommendations</option><option value="EXCLUDED">Exclude from recommendations</option></select></label>
      {recommendationStatus === 'EXCLUDED' && <><label className="block md:col-span-2"><span className="text-sm font-semibold text-slate-700">Reason for exclusion <span className="text-red-700">*</span></span><textarea value={note} onChange={event => setNote(event.target.value)} required maxLength={1000} rows={2} placeholder="For example: Direct online application; broker channel is not available." className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"/></label><label className="block md:col-span-2"><span className="text-sm font-semibold text-slate-700">Official source link <span className="font-normal text-slate-500">(recommended)</span></span><input type="url" value={sourceUri} onChange={event => setSourceUri(event.target.value)} placeholder="https://bank.example.com/product-terms" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"/></label></>}
      {product.recommendationReviewedAt && <p className="text-xs text-slate-500 md:col-span-2">Last reviewed {new Date(product.recommendationReviewedAt).toLocaleString('en-AU')}{product.recommendationReviewer ? ` by ${product.recommendationReviewer.fullName || product.recommendationReviewer.email}` : ''}</p>}
      {error && <p role="alert" className="text-sm text-red-700 md:col-span-2">{error}</p>}
      <div className="md:col-span-2"><button type="submit" disabled={saving || !changed || (recommendationStatus === 'EXCLUDED' && !note.trim())} className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving…' : 'Save recommendation setting'}</button></div>
    </form>
  </article>;
}
