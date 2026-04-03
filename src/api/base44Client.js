const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('auth_token') || '';
}

function headers(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra };
  const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function request(method, path, body) {
  const opts = { method, headers: headers() };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const e = new Error(err.error || `HTTP ${res.status}`);
    e.status = res.status;
    e.data = err;
    throw e;
  }
  return res.json();
}

/** POST without Authorization (login / telegram). */
async function requestPublic(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const e = new Error(err.error || `HTTP ${res.status}`);
    e.status = res.status;
    e.data = err;
    e.code = err.code;
    throw e;
  }
  return res.json();
}

function makeEntityProxy(entityName) {
  return {
    async list(sort, limit) {
      const params = new URLSearchParams();
      if (sort) params.set('sort', sort);
      if (limit) params.set('limit', String(limit));
      const qs = params.toString();
      return request('GET', `/entities/${entityName}${qs ? '?' + qs : ''}`);
    },
    async filter(filters = {}, sort, limit) {
      return request('POST', `/entities/${entityName}/filter`, { ...filters, sort, limit });
    },
    async create(data) {
      return request('POST', `/entities/${entityName}`, data);
    },
    async update(id, data) {
      return request('PUT', `/entities/${entityName}/${id}`, data);
    },
    async delete(id) {
      return request('DELETE', `/entities/${entityName}/${id}`);
    },
  };
}

const entityCache = {};
function getEntity(name) {
  if (!entityCache[name]) entityCache[name] = makeEntityProxy(name);
  return entityCache[name];
}

const entitiesProxy = new Proxy({}, {
  get(_target, prop) {
    return getEntity(prop);
  },
});

const functionsAPI = {
  async invoke(name, payload) {
    const data = await request('POST', `/functions/${name}`, payload);
    return { data };
  },
};

const authAPI = {
  async login(email, password) {
    const result = await requestPublic('POST', '/auth/login', { email, password });
    if (result.token) localStorage.setItem('auth_token', result.token);
    return result;
  },
  async loginTelegram(payload) {
    const result = await requestPublic('POST', '/auth/telegram', payload);
    if (result.token) localStorage.setItem('auth_token', result.token);
    return result;
  },
  async me() {
    return request('GET', '/auth/me');
  },
  async logout(redirectUrl) {
    localStorage.removeItem('auth_token');
    if (redirectUrl) window.location.href = '/login';
  },
  redirectToLogin(returnUrl) {
    window.location.href = '/login';
  },
};

const integrationsAPI = {
  Core: {
    async UploadFile({ file }) {
      const formData = new FormData();
      formData.append('file', file);
      const token = getToken();
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `Upload failed: ${res.status}`);
      }
      const data = await res.json();
      data.file_url = data.url;
      return data;
    },
    async InvokeLLM({ prompt, response_type, model }) {
      return functionsAPI.invoke('invokeLLM', { prompt, response_type, model }).then(r => r.data);
    },
  },
};

export const base44 = {
  entities: entitiesProxy,
  functions: functionsAPI,
  auth: authAPI,
  integrations: integrationsAPI,
};

export default base44;
