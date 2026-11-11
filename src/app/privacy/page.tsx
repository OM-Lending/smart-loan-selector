import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage';
import { legalDocument } from '@/lib/legal/documents';

const document = legalDocument('PRIVACY');
export const metadata = { title: `${document.title} | OpenLending` };
export default function Page() { return <LegalDocumentPage document={document}/>; }
