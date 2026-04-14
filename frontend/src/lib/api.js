import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- 401 interceptor: auto-refresh access token ---
let isRefreshing = false;
let pendingQueue = [];

function processQueue(error) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve();
  });
  pendingQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt refresh on 401, and not for auth endpoints themselves
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/register') &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/google/session')
    ) {
      if (isRefreshing) {
        // Another refresh is in flight — queue this request
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await api.post('/auth/refresh');
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        // Refresh failed — redirect to login
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Auth endpoints
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  refresh: () => api.post('/auth/refresh'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) =>
    api.post('/auth/reset-password', { token, new_password: newPassword }),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword }),
  googleSession: (sessionId) => api.post('/auth/google/session', { session_id: sessionId }),
};

// Files endpoints
export const filesApi = {
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  list: (skip = 0, limit = 50) => api.get(`/files?skip=${skip}&limit=${limit}`),
  preview: (fileId) => api.get(`/files/preview/${fileId}`),
  import: (fileId) => api.post(`/files/import/${fileId}`),
  delete: (fileId) => api.delete(`/files/${fileId}`),
};

// Transactions endpoints
export const transactionsApi = {
  list: (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    });
    return api.get(`/transactions?${queryParams.toString()}`);
  },
  get: (id) => api.get(`/transactions/${id}`),
  update: (id, data) => api.patch(`/transactions/${id}`, data),
  delete: (id) => api.delete(`/transactions/${id}`),
  categories: () => api.get('/transactions/categories'),
  bulkUpdate: (transactionIds, update) =>
    api.post('/transactions/bulk-update', { transaction_ids: transactionIds, update }),
};

// Dashboard endpoints
export const dashboardApi = {
  get: (month, year) => {
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (year) params.append('year', year);
    return api.get(`/dashboard?${params.toString()}`);
  },
  stats: () => api.get('/dashboard/stats'),
};

// Insights endpoints
export const insightsApi = {
  getAll: () => api.get('/insights'),
  recurring: () => api.get('/insights/recurring'),
  unusual: () => api.get('/insights/unusual'),
  savings: () => api.get('/insights/savings'),
  compare: (period1Start, period1End, period2Start, period2End) =>
    api.get('/insights/compare', {
      params: {
        period1_start: period1Start,
        period1_end: period1End,
        period2_start: period2Start,
        period2_end: period2End,
      },
    }),
};

// Reports endpoints
export const reportsApi = {
  generate: (data) => api.post('/reports/generate', data),
  list: (skip = 0, limit = 20) => api.get(`/reports?skip=${skip}&limit=${limit}`),
  get: (id) => api.get(`/reports/${id}`),
  delete: (id) => api.delete(`/reports/${id}`),
  exportCsv: (id) => api.get(`/reports/${id}/export`, { responseType: 'blob' }),
};

// Budgets endpoints
export const budgetsApi = {
  list: () => api.get('/budgets'),
  create: (data) => api.post('/budgets', data),
  delete: (id) => api.delete(`/budgets/${id}`),
};

// Settings endpoints
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data) => api.patch('/settings', data),
  getProfile: () => api.get('/settings/profile'),
  updateProfile: (data) => api.patch('/settings/profile', data),
  listAccounts: () => api.get('/settings/accounts'),
  createAccount: (data) => api.post('/settings/accounts', data),
  deleteAccount: (id) => api.delete(`/settings/accounts/${id}`),
};

export default api;
