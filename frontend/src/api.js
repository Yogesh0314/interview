import axios from 'axios';

// In production (served via Nginx), API requests use relative paths (/api/...)
// In local dev mode (Vite), fallback to http://localhost:5000 if VITE_API_URL is not set
export const API_BASE_URL = import.meta.env.VITE_API_URL !== undefined 
  ? import.meta.env.VITE_API_URL 
  : (import.meta.env.MODE === 'production' ? '' : 'http://localhost:5000');

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
