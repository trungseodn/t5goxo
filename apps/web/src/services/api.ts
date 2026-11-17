import axios from 'axios';

const api = axios.create({
  baseURL: '/api', /** Proxied to NestJS via Vite */
  timeout: 300000, /** 5 minutes */
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ztteam_access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Global response interceptor to handle 401 Unauthorized */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      /** Tránh reload vô tận khi đang ở màn hình login hoặc đang gọi endpoint /auth/login */
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      if (!isLoginRequest) {
        localStorage.removeItem('ztteam_access_token');
        localStorage.removeItem('ztteam_user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
