import axios from 'axios';

// The backend serves BOTH the API (/api/v1) and the uploaded files (/uploads),
// so they must share one origin. In production that origin is the dedicated
// API subdomain over HTTPS; in local development it is the backend on :5000.
// Pointing uploads anywhere else (e.g. http://localhost:5123) breaks images
// on the live site and is blocked as mixed content on an HTTPS page.
const hostname = window.location.hostname;
const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
const API_ORIGIN = isLocalhost
  ? `http://${hostname}:5000`
  : 'https://api-crm.au2ka.cloud';

const API_BASE_URL = `${API_ORIGIN}/api/v1`;

export const UPLOADS_BASE_URL = API_ORIGIN;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor to handle auth failures
api.interceptors.response.use((response) => {
  return response;
}, (error) => {
  if (error.response && error.response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
  }
  return Promise.reject(error);
});
