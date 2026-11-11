import { LegalDocumentPage } from '@/components/legal/LegalDocumentPage';
import { legalDocument } from '@/lib/legal/documents';

const document = legalDocument('COLLECTION_NOTICE');
export const metadata = { title: `${document.title} | OpenLending` };
export default function Page() { return <LegalDocumentPage document={document}/>; }
