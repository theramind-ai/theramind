import { supabase } from './supabaseClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = {
  // Método genérico para requisições autenticadas
  async request(method, endpoint, data = null, options = {}) {
    const token = (await supabase.auth.getSession()).data.session?.access_token;

    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      },
      ...options
    };

    if (data) {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, config);

      if (!response.ok) {
        if (response.status === 401) {
          await supabase.auth.signOut();
          window.location.href = '/login';
          throw new Error('Sessão expirada. Por favor, faça login novamente.');
        }

        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Erro na requisição');
      }

      // Se a resposta for 204 (No Content), retorna null
      if (response.status === 204) return null;

      if (options.responseType === 'blob') {
        return await response.blob();
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },

  // Métodos HTTP
  get(endpoint, options = {}) {
    return this.request('GET', endpoint, null, options);
  },

  post(endpoint, data, options = {}) {
    return this.request('POST', endpoint, data, options);
  },

  put(endpoint, data, options = {}) {
    return this.request('PUT', endpoint, data, options);
  },

  delete(endpoint, options = {}) {
    return this.request('DELETE', endpoint, null, options);
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

  // Copilot Chat - Métodos Específicos
  copilot: {
    sendMessage(message, conversationId = null) {
      // Precisamos usar 'api.post' aqui. Como 'this' dentro de 'copilot' refere-se a 'copilot', 
      // e 'api' é a const definida fora, podemos referenciar 'api' diretamente.
      return api.post('/copilot/chat', { message, conversation_id: conversationId });
    },
    listConversations() {
      return api.get('/copilot/conversations');
    },
    getMessages(conversationId) {
      return api.get(`/copilot/conversations/${conversationId}/messages`);
    }
  }
};

export default api;
