import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const db = globalThis.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = db;
}

// Helper function to generate anonymous ID
export function generateAnonymousId(): string {
  return `anon_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// Helper function to get or create anonymous session
export async function getOrCreateAnonymousSession(anonymousId: string) {
  let session = await db.auditSession.findUnique({
    where: { anonymousId },
    include: {
      answers: true,
      _count: {
        select: {
          chatMessages: true,
        },
      },
    },
  });

  if (!session) {
    session = await db.auditSession.create({
      data: {
        anonymousId,
        status: 'DRAFT',
      },
      include: {
        answers: true,
        _count: {
          select: {
            chatMessages: true,
          },
        },
      },
    });
  }

  return session;
}

// Helper function to get or create user session
export async function getOrCreateUserSession(userId: string) {
  let session = await db.auditSession.findFirst({
    where: { 
      userId,
      status: 'DRAFT'
    },
    include: {
      answers: true,
      user: true,
      _count: {
        select: {
          chatMessages: true,
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  if (!session) {
    session = await db.auditSession.create({
      data: {
        userId,
        status: 'DRAFT',
      },
      include: {
        answers: true,
        user: true,
        _count: {
          select: {
            chatMessages: true,
          },
        },
      },
    });
  }

  return session;
}

// Helper function to convert guest session to user session
export async function convertGuestToUser(
  anonymousId: string,
  userId: string
) {
  return await db.$transaction(async (tx) => {
    // Find existing guest session
    const guestSession = await tx.auditSession.findUnique({
      where: { anonymousId },
      include: { answers: true, chatMessages: true },
    });

    if (!guestSession) {
      throw new Error('Guest session not found');
    }

    // Check if user already has a session
    const existingUserSession = await tx.auditSession.findFirst({
      where: { userId, status: 'DRAFT' },
    });

    if (existingUserSession) {
      // Delete the existing user session and keep guest data
      await tx.auditSession.delete({
        where: { id: existingUserSession.id },
      });
    }

    // Convert guest session to user session
    const updatedSession = await tx.auditSession.update({
      where: { id: guestSession.id },
      data: {
        userId,
        anonymousId: null,
        updatedAt: new Date(),
      },
      include: {
        answers: true,
        user: true,
        _count: {
          select: {
            chatMessages: true,
          },
        },
      },
    });

    return updatedSession;
  });
}