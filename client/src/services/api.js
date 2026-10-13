import axios from 'axios';

// One axios instance for all three panels. Cookies carry the login; the header blocks cross-site forgery.
const http = axios.create({ baseURL: '/api/v1', withCredentials: true, headers: { 'X-Requested-With': 'XMLHttpRequest' }, timeout: 20000 });

http.interceptors.response.use(
  (res) => res.data.data,
  (err) => {
    const e = err.response?.data?.error;
    const error = new Error(e?.message || (err.code === 'ECONNABORTED' ? 'The server is taking too long. Please try again.' : 'Network problem. Please check your connection.'));
    error.code = e?.code; error.status = err.response?.status; error.details = e?.details;
    return Promise.reject(error);
  }
);

export const api = {
  get: (url, params) => http.get(url, { params }),
  post: (url, body) => http.post(url, body ?? {}),
  patch: (url, body) => http.patch(url, body ?? {}),
  put: (url, body) => http.put(url, body ?? {}),
  del: (url) => http.delete(url),
  upload: (url, file) => { const f = new FormData(); f.append('image', file); return http.post(url, f); },
};
