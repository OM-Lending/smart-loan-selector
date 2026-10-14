import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/server/lib/prisma';

/** Resolves a Clerk session to the application's stable, UUID-backed profile. */
export async function getAuthenticatedProfile() {
  const { userId } = await auth();
  if (!userId) return null;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const emailAddress = clerkUser.emailAddresses.find(
    (email) => email.id === clerkUser.primaryEmailAddressId,
  );
  const email = emailAddress?.emailAddress.trim().toLowerCase();
  if (!email) return null;

  const profileByClerkId = await prisma.profile.findUnique({ where: { clerkUserId: userId } });
  const profile = profileByClerkId ?? await prisma.profile.findUnique({ where: { email } });
  if (profile?.deletedAt || (profile?.clerkUserId && profile.clerkUserId !== userId)) return null;

  return {
    clerkUserId: userId,
    email,
    emailVerified: emailAddress?.verification?.status === 'verified',
    fullName: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null,
    avatarUrl: clerkUser.imageUrl || null,
    profile,
  };
}
