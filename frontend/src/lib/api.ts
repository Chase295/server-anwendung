import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

/**
 * Axios-Instanz für API-Calls
 */
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request-Interceptor für Auth-Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response-Interceptor für Error-Handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token ungültig - redirect zu Login
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/**
 * API-Services
 */
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  
  changeCredentials: (data: {
    currentUsername: string;
    currentPassword: string;
    newUsername?: string;
    newPassword?: string;
  }) => api.put('/auth/admin/credentials', data),
  
  listSecrets: () => api.get('/auth/secrets'),
  
  saveSecret: (key: string, value: string, type: string, description?: string) =>
    api.post('/auth/secrets', { key, value, type, description }),
  
  deleteSecret: (key: string) => api.delete(`/auth/secrets/${key}`),
};

export const devicesApi = {
  getAll: () => api.get('/devices'),
  
  getOne: (clientId: string) => api.get(`/devices/${clientId}`),
  
  register: (data: {
    clientId: string;
    name: string;
    capabilities: string[];
    metadata?: any;
  }) => api.post('/devices', data),
  
  delete: (clientId: string) => api.delete(`/devices/${clientId}`),
  
  getConnected: () => api.get('/devices/connected/list'),
};

export const flowsApi = {
  getAll: () => api.get('/flows'),
  
  getSchemas: () => api.get('/flows/schemas'),
  
  getOne: (id: string) => api.get(`/flows/${id}`),
  
  create: (data: { name: string; description: string; definition: any }) =>
    api.post('/flows', data),
  
  update: (id: string, data: any) => api.put(`/flows/${id}`, data),
  
  delete: (id: string) => api.delete(`/flows/${id}`),
  
  start: (id: string) => api.post(`/flows/${id}/start`),
  
  stop: (id: string) => api.post(`/flows/${id}/stop`),
};

export const logsApi = {
  getLogs: (level?: string, limit?: number, offset?: number) => 
    api.get('/logs', { params: { level, limit, offset } }),
  
  getLive: (since?: number) => 
    api.get('/logs/live', { params: { since } }),
};

