import axios from 'axios';

/**
 * M7 — the customer portal's own API client.
 *
 * Kept separate from the staff client on purpose: the portal has its own
 * token, its own storage key, and must never send a staff JWT.
 */
import { API_ORIGIN } from '../../lib/apiOrigin';

export const PORTAL_UPLOADS_BASE_URL = API_ORIGIN;

export const portalApi = axios.create({
  baseURL: `${API_ORIGIN}/api/v1/portal`,
  headers: { 'Content-Type': 'application/json' },
});

const TOKEN_KEY = 'au2ka_portal_token';

export function getPortalToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setPortalToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // A browser with storage blocked still works for this session.
  }
}

portalApi.interceptors.request.use(config => {
  const token = getPortalToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

portalApi.interceptors.response.use(
  response => response,
  error => {
    // An expired session sends the customer back to the sign-in screen.
    if (error.response?.status === 401) {
      setPortalToken(null);
      if (!window.location.search.includes('portal-expired')) {
        window.location.href = '/?portal=1&portal-expired=1';
      }
    }
    return Promise.reject(error);
  },
);

/**
 * طلب الانضمام — واجهة عامة خارج مسار البوابة.
 *
 * لا يمر على portalApi لأن ذاك يحمل توكن العميل ويعيد التوجيه عند 401،
 * وصاحب الطلب لا توكن له أصلًا.
 */
export async function submitJoinRequest(payload: {
  fullName: string;
  mobileNumber: string;
  brand?: string | null;
  model?: string | null;
  plateNumber?: string | null;
  referralCode?: string | null;
}) {
  return axios.post(`${API_ORIGIN}/api/v1/public/join-request`, payload);
}
