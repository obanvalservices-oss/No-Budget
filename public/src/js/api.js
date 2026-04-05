<script>
  (function () {
    const BASE_URL = window.APP_API_BASE || '/api';

    function getToken() {
      return localStorage.getItem('token'); // guarda aquí el JWT tras login
    }
    function setToken(t) { localStorage.setItem('token', t); }
    function clearToken() { localStorage.removeItem('token'); }

    async function api(path, { method='GET', body, headers={} } = {}) {
      const token = getToken();
      const res = await fetch(BASE_URL + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      const json = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
      return json;
    }

    window.$api = api;
    window.$auth = { getToken, setToken, clearToken };
  })();
</script>
