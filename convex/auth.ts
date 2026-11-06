/**
 * Sign-in for students and offices (Convex Auth).
 *
 * - Google: OAuth. Needs AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET set on the Convex deployment.
 * - Email + password: passwords are never stored. Convex Auth hashes each one with Scrypt and a
 *   random per-password salt (stored alongside the hash), and verifies in constant time.
 */
import Google from '@auth/core/providers/google';
import { Password } from '@convex-dev/auth/providers/Password';
import { convexAuth } from '@convex-dev/auth/server';
import { ConvexError } from 'convex/values';
import type { DataModel } from './_generated/dataModel';

export const MIN_PASSWORD = 8;

/** At least 8 characters with a letter and a number. Mirrored in the login form. */
export function checkPassword(password: string) {
  if (password.length < MIN_PASSWORD) throw new ConvexError(`Use at least ${MIN_PASSWORD} characters.`);
  if (!/[a-z]/i.test(password) || !/\d/.test(password)) {
    throw new ConvexError('Use at least one letter and one number.');
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google,
    Password<DataModel>({
      profile(params) {
        const email = String(params.email ?? '')
          .trim()
          .toLowerCase();
        if (!EMAIL.test(email)) throw new ConvexError('Enter a valid email address.');
        const name = typeof params.name === 'string' && params.name.trim() ? params.name.trim() : undefined;
        return { email, ...(name ? { name } : {}) };
      },
      validatePasswordRequirements: checkPassword,
    }),
  ],
});
