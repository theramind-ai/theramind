// src/lib/api.js
import { supabase } from './supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = {
  async request(method, endpoint, data = null) {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    
    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
    };

    if (data) {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, config);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Erro na requisição');
      }

      if (response.status === 204) return null;
      
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },

  // Métodos HTTP
  get(endpoint) {
    return this.request('GET', endpoint);
  },

  post(endpoint, data) {
    return this.request('POST', endpoint, data);
  },

  put(endpoint, data) {
    return this.request('PUT', endpoint, data);
  },

  delete(endpoint) {
    return this.request('DELETE', endpoint);
  },

  // Upload de arquivo
  async uploadFile(endpoint, file, patientId) {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('patient_id', patientId);

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Erro no upload do arquivo');
      }

      return await response.json();
    } catch (error) {
      console.error('Upload Error:', error);
      throw error;
    }
  },
};

export default api;