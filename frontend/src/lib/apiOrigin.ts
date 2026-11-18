/**
 * The one origin the whole app talks to.
 *
 * The backend serves BOTH the API (`/api/v1`) and the uploaded files
 * (`/uploads`), so they must share one origin — pointing uploads anywhere else
 * breaks every image on the live site, and is blocked outright as mixed
 * content on an HTTPS page.
 *
 * The origin used to be a domain written into the code, which meant the built
 * files only ever worked on that one domain: moving the system to another
 * server needed a code change and a rebuild. Now:
 *
 *   - `VITE_API_ORIGIN` wins when it is set at build time, for the case where
 *     the API lives on its own subdomain;
 *   - otherwise the app calls the same origin it was served from, and the web
 *     server passes `/api/` and `/uploads/` through to the backend (see
 *     `deploy/nginx/`). The same build then runs on our server and on the
 *     customer's, with no rebuild;
 *   - in local development it is the backend on :5000.
 */
const hostname = window.location.hostname;
const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

const configured = (import.meta.env.VITE_API_ORIGIN || '').trim().replace(/\/+$/, '');

export const API_ORIGIN = configured || (isLocalhost ? `http://${hostname}:5000` : window.location.origin);

/** Where the uploaded photos and documents are served from. */
export const UPLOADS_BASE_URL = API_ORIGIN;

/** The versioned API root. */
export const API_BASE_URL = `${API_ORIGIN}/api/v1`;
