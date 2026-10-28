import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { ContactDetails } from '@/lib/validations/application';

export class ApplicationProfileError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}

export async function resolveApplicationProfile(
  tx: Pick<Prisma.TransactionClient, 'profile'>,
  identity: { clerkUserId: string; email: string },
  contact?: ContactDetails,
) {
  let profile = await tx.profile.findUnique({ where: { clerkUserId: identity.clerkUserId } });
  if (!profile) profile = await tx.profile.findUnique({ where: { email: identity.email } });
  if (profile?.deletedAt) throw new ApplicationProfileError('ACCOUNT_UNAVAILABLE', 'This account is unavailable.', 403);
  if (profile?.clerkUserId && profile.clerkUserId !== identity.clerkUserId) {
    throw new ApplicationProfileError('ACCOUNT_IDENTITY_CONFLICT', 'This email is already linked to another login account.', 409);
  }
  if (profile) {
    // Link legacy profiles by their verified email, but never overwrite contact
    // details, the role or the stable UUID when creating another application.
    if (!profile.clerkUserId) profile = await tx.profile.update({
      where: { id: profile.id, AND: { clerkUserId: null } }, data: { clerkUserId: identity.clerkUserId },
    });
    return profile;
  }
  if (!contact) throw new ApplicationProfileError('CONTACT_DETAILS_REQUIRED', 'Complete your contact details once before creating your first application.', 400);
  if (contact.email.trim().toLowerCase() !== identity.email) {
    throw new ApplicationProfileError('VERIFIED_EMAIL_MISMATCH', 'Use the verified email address for your signed-in account.', 403);
  }
  return tx.profile.create({ data: {
    id: randomUUID(), clerkUserId: identity.clerkUserId, email: identity.email,
    fullName: `${contact.firstName} ${contact.lastName}`, phone: `+61${contact.phone}`, role: 'CUSTOMER',
  } });
}
