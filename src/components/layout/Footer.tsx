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
            © {currentYear} Smart Loan Selector Australia Pty Ltd | ABN 123 456 789 | Australian Credit Licence 000000
          </p>
          <p>
            Smart Loan Selector Financial Group Pty Ltd is the holding company of the Smart Loan Selector comparison platform, owned by institutional investors, technology founders, and Australian credit partners.
          </p>
          <p className="text-[11px] text-slate-400 max-w-4xl">
            Disclaimer: Information provided on this platform is general in nature and does not constitute financial or credit advice. Interest rates, fees, and product features sourced via Open Banking (CDR API) are updated daily. Please consider your own financial circumstances before making any decisions.
          </p>
        </div>
      </div>
    </footer>
  );
}