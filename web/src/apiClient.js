const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');

async function parsePayload(response) {
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    return null;
  }

  return response.json();
}

function buildError(response, payload) {
  const message = payload?.message || `Request failed with status ${response.status}`;
  const error = new Error(message);
  error.status = response.status;
  error.code = payload?.code || 'REQUEST_FAILED';
  error.payload = payload;
  return error;
}

async function send({ path, method, body, accessToken }) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
}

export async function apiRequest({
  path,
  method = 'GET',
  body,
  auth,
  onAuthChange,
  onUnauthorized,
  skipRefresh = false
}) {
  const response = await send({
    path,
    method,
    body,
    accessToken: auth?.accessToken
  });

  if (response.status === 401 && !skipRefresh && auth?.refreshToken) {
    const refreshResponse = await send({
      path: '/auth/refresh',
      method: 'POST',
      body: { refreshToken: auth.refreshToken }
    });

    const refreshPayload = await parsePayload(refreshResponse);

    if (refreshResponse.ok && refreshPayload?.success && refreshPayload?.data?.accessToken) {
      const nextAuth = {
        user: refreshPayload.data.user,
        accessToken: refreshPayload.data.accessToken,
        refreshToken: refreshPayload.data.refreshToken
      };

      onAuthChange?.(nextAuth);

      return apiRequest({
        path,
        method,
        body,
        auth: nextAuth,
        onAuthChange,
        onUnauthorized,
        skipRefresh: true
      });
    }

    onUnauthorized?.();
    throw buildError(refreshResponse, refreshPayload);
  }

  const payload = await parsePayload(response);

  if (!response.ok || !payload?.success) {
    throw buildError(response, payload);
  }

  return payload;
}