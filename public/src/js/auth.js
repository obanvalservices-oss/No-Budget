/**
 * Axios: baseURL = /api. Use paths like /auth/login, /ingresos (never /api/... again).
 */
(function initAuth() {
  window.APP_API_BASE = window.APP_API_BASE || '/api';
  axios.defaults.baseURL = window.APP_API_BASE;

  const token = localStorage.getItem('token');
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }

  axios.defaults.timeout = 15000;

  axios.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err?.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];
        if (location.pathname.includes('/dashboard/')) {
          location.href = '/src/login.html';
        }
      }
      return Promise.reject(err);
    },
  );
})();
