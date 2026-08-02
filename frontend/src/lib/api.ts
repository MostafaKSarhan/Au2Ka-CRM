import axios from 'axios';

// In local development the backend runs on :5000 as a separate process.
// In production the app is served over HTTPS behind nginx, which proxies
// /api and /uploads to the backend on the same origin. Using absolute
// http://host:5000 URLs there would be blocked as mixed content, so we fall
// back to same-origin relative URLs whenever we're not on localhost.
const hostname = window.location.hostname;
const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
const ORIGIN = isLocalhost ? `http://${hostname}:5000` : '';

const API_BASE_URL = `${ORIGIN}/api/v1`;

export const UPLOADS_BASE_URL = ORIGIN;

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
