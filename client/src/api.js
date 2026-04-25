import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'x-api-key': import.meta.env.VITE_API_KEY,
  },
});

export const contacts = {
  list: (params) => api.get('/contacts', { params }).then(r => r.data),
  create: (data) => api.post('/contacts', data).then(r => r.data),
  update: (id, data) => api.put(`/contacts/${id}`, data).then(r => r.data),
  remove: (id) => api.delete(`/contacts/${id}`).then(r => r.data),
  stats: () => api.get('/contacts/stats/overview').then(r => r.data),
};

export const importer = {
  upload: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
};

export const messages = {
  templates: () => api.get('/messages/templates').then(r => r.data),
  addTemplate: (data) => api.post('/messages/templates', data).then(r => r.data),
  deleteTemplate: (id) => api.delete(`/messages/templates/${id}`).then(r => r.data),
  campaigns: () => api.get('/messages/campaigns').then(r => r.data),
  campaignLogs: (id) => api.get(`/messages/campaigns/${id}/logs`).then(r => r.data),
};

export const sender = {
  bulkSend: (data) => api.post('/send/bulk', data).then(r => r.data),
  status: (id) => api.get(`/send/status/${id}`).then(r => r.data),
};

export default api;