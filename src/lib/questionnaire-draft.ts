import { normalizeApplicationAnswers, QuestionnaireDraftSchema, type ApplicationFormInput } from '@/lib/validations/application';

const DRAFT_KEY = 'questionnaire_draft';

export function readQuestionnaireDraft(owner: string | null, verifiedEmail?: string): Partial<ApplicationFormInput> | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    // Recover snapshots created before in-progress autosave was introduced.
    const draft = raw ? JSON.parse(raw) : {
      version: 1,
      owner: sessionStorage.getItem('pending_quote_owner'),
      values: JSON.parse(sessionStorage.getItem('pending_loan_data') ?? 'null'),
    };
    if (draft?.version !== 1 || !draft.values || typeof draft.values !== 'object' || Array.isArray(draft.values)) return null;
    const ownVerifiedGuestDraft = owner && draft.owner === null && verifiedEmail
      && typeof draft.values.email === 'string' && draft.values.email.trim().toLowerCase() === verifiedEmail.trim().toLowerCase();
    if (draft.owner !== owner && !ownVerifiedGuestDraft) return null;
    // A partially entered invalid number should not discard all other answers.
    const values: Record<string, unknown> = {};
    const answers = normalizeApplicationAnswers(draft.values);
    for (const [key, schema] of Object.entries(QuestionnaireDraftSchema.shape)) {
      const field = schema.safeParse(answers[key]);
      if (field.success && field.data !== undefined) values[key] = field.data;
    }
    const parsed = QuestionnaireDraftSchema.safeParse(values);
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

export function clearPendingApplication() {
  sessionStorage.removeItem('pending_loan_data');
  sessionStorage.removeItem('pending_quote_owner');
}

export function writeQuestionnaireDraft(owner: string | null, values: object) {
  // Editing invalidates the older submission snapshot before saving the latest
  // form. Never let verification retry an application the customer has changed.
  clearPendingApplication();
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, owner, values }));
}

export function clearQuestionnaireDraft() {
  sessionStorage.removeItem(DRAFT_KEY);
}
