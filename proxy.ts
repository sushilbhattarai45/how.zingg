/**
 * Auth gate (Next.js 16 "proxy", formerly middleware).
 * - /app needs a signed-in user; signed-out visitors go to /login?next=…
 * - Signed-in users who open /login go straight to the app.
 * - DEMO_MODE=1 skips the gate so the Expo demo and e2e tests never hit a login wall.
 */
import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from '@convex-dev/auth/nextjs/server';

const isLogin = createRouteMatcher(['/login']);
const isProtected = createRouteMatcher(['/app(.*)']);
const demo = process.env.DEMO_MODE === '1';

export const proxy = convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  if (demo) return;
  const signedIn = await convexAuth.isAuthenticated();
  if (isLogin(request) && signedIn) return nextjsMiddlewareRedirect(request, '/app');
  if (isProtected(request) && !signedIn) {
    const next = encodeURIComponent(request.nextUrl.pathname);
    return nextjsMiddlewareRedirect(request, `/login?next=${next}`);
  }
});

export const config = {
  // Run on everything except static files and Next internals.
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
