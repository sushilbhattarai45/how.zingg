import { httpRouter } from 'convex/server';
import { auth } from './auth';

const http = httpRouter();

// Sign-in callbacks (Google OAuth) and the JWKS endpoint for Convex Auth.
auth.addHttpRoutes(http);

export default http;
