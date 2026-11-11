import Link from 'next/link';
export function CollectionNotice() {
  return <p className="text-xs leading-5 text-slate-500">OM LENDING PTY LTD uses your information to assist with your home loan enquiry. Read our <Link href="/collection-notice" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">Collection Notice</Link>.</p>;
}
