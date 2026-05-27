// Centraliza todas as chamadas para a Forge API
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function getToken() {
  return localStorage.getItem('forge_token')
}

async function request(method, path, body) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    // Token expirado — limpa e recarrega para login
    localStorage.removeItem('forge_token')
    window.location.href = '/login'
    return null
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }

  return res.json()
}

// ── Auth ──────────────────────────────────────────────────────────────────
export const api = {
  auth: {
    me:         ()       => request('GET',   '/auth/me'),
    updateMe:   (data)   => request('PATCH', '/auth/me', data),
    googleUrl:  ()       => `${BASE}/auth/google`,
  },

  // ── Tasks ──────────────────────────────────────────────────────────────
  tasks: {
    list:        ()         => request('GET',    '/tasks'),
    create:      (data)     => request('POST',   '/tasks', data),
    update:      (id, data) => request('PATCH',  `/tasks/${id}`, data),
    delete:      (id)       => request('DELETE', `/tasks/${id}`),
    toggleSub:   (taskId, subId, done) =>
                              request('PATCH', `/tasks/${taskId}/subtasks/${subId}`, { done }),
  },
}

export function isAuthenticated() {
  return !!getToken()
}

export function saveToken(token) {
  localStorage.setItem('forge_token', token)
}

export function clearToken() {
  localStorage.removeItem('forge_token')
}
