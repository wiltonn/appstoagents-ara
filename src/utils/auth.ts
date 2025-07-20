import { convertGuestToUser } from './db';

/**
 * Convert anonymous guest session to authenticated user session
 * This should be called when a guest user signs up or signs in
 */
export async function convertGuestSession(anonymousId: string, userId: string) {
  try {
    const convertedSession = await convertGuestToUser(anonymousId, userId);
    console.log(`✅ Converted guest session ${anonymousId} to user ${userId}`);
    return convertedSession;
  } catch (error) {
    console.error('Error converting guest session:', error);
    throw error;
  }
}

/**
 * Set anonymous ID cookie for guest users
 */
export function setAnonymousIdCookie(anonymousId: string): string {
  // Create cookie with 30 day expiration
  const expires = new Date();
  expires.setDate(expires.getDate() + 30);
  
  return `anonymous_id=${anonymousId}; Path=/; Expires=${expires.toUTCString()}; SameSite=Lax; Secure=${process.env.NODE_ENV === 'production'}`;
}

/**
 * Clear anonymous ID cookie (when user authenticates)
 */
export function clearAnonymousIdCookie(): string {
  return `anonymous_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

/**
 * Extract anonymous ID from cookie string
 */
export function getAnonymousIdFromCookie(cookieString: string | null): string | null {
  if (!cookieString) return null;
  
  const match = cookieString.match(/anonymous_id=([^;]+)/);
  return match ? match[1] : null;
}