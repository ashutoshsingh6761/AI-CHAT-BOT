// client/js/api.js
// Thin wrapper around fetch() for talking to our own backend.
// No external dependency - keeps things simple and debuggable.

const API_BASE = '/api';

const Api = (() => {
  function getToken() {
    return localStorage.getItem('nimbus_token');
  }

  function setToken(token) {
    if (token) localStorage.setItem('nimbus_token', token);
    else localStorage.removeItem('nimbus_token');
  }

  async function request(path, { method = 'GET', body, headers = {} } = {}) {
    const token = getToken();
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      // non-JSON response (unlikely, but don't crash)
    }

    if (!res.ok) {
      const message = data?.message || `Request failed (${res.status})`;
      const error = new Error(message);
      error.status = res.status;
      error.errors = data?.errors;
      throw error;
    }

    return data;
  }

  // ---- Auth ----
  const register = (name, email, password) =>
    request('/auth/register', { method: 'POST', body: { name, email, password } });

  const login = (email, password) =>
    request('/auth/login', { method: 'POST', body: { email, password } });

  const getMe = () => request('/auth/me');

  // ---- Chat ----
  const getHistory = () => request('/chat/history');

  const getChat = (id) => request(`/chat/${id}`);

  const renameChat = (id, title) => request(`/chat/${id}`, { method: 'PATCH', body: { title } });

  const deleteChat = (id) => request(`/chat/${id}`, { method: 'DELETE' });

  const sendMessage = (payload) => request('/chat', { method: 'POST', body: payload });

  /**
   * Streams a chat response via Server-Sent Events.
   * @param {object} payload - { message, chatId, temperature, maxTokens }
   * @param {object} handlers - { onMeta, onChunk, onDone, onError }
   * @returns {() => void} abort function
   */
  function streamMessage(payload, handlers = {}) {
    const controller = new AbortController();
    const token = getToken();

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/chat?stream=true`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          let msg = `Request failed (${res.status})`;
          try {
            const data = await res.json();
            msg = data?.message || msg;
          } catch {
            /* ignore */
          }
          handlers.onError?.(new Error(msg));
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split('\n\n');
          buffer = events.pop(); // keep incomplete event for next read

          for (const rawEvent of events) {
            const lines = rawEvent.split('\n');
            let eventName = 'message';
            let dataStr = '';
            for (const line of lines) {
              if (line.startsWith('event:')) eventName = line.slice(6).trim();
              else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
            }
            if (!dataStr) continue;

            let data;
            try {
              data = JSON.parse(dataStr);
            } catch {
              continue;
            }

            if (eventName === 'meta') handlers.onMeta?.(data);
            else if (eventName === 'chunk') handlers.onChunk?.(data.delta);
            else if (eventName === 'done') handlers.onDone?.(data);
            else if (eventName === 'error') handlers.onError?.(new Error(data.message));
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') handlers.onError?.(err);
      }
    })();

    return () => controller.abort();
  }

  return {
    getToken,
    setToken,
    register,
    login,
    getMe,
    getHistory,
    getChat,
    renameChat,
    deleteChat,
    sendMessage,
    streamMessage,
  };
})();
