// /src/js/login.js
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  try {
    const { data } = await axios.post('/auth/login', { email, password });

    const token = data.token || data.access_token;
    if (!token) throw new Error('Token not received');

    const user = data.user
      ? { id: data.user.id, nombre: data.user.nombre || data.user.name || '', email: data.user.email }
      : null;

    localStorage.setItem('token', token);
    if (user) localStorage.setItem('user', JSON.stringify(user));

    window.location.href = '/src/dashboard/home.html';
  } catch (err) {
    const msg =
      err?.response?.data?.message ||
      (err?.message === 'Network Error'
        ? 'Could not reach the server. Check your connection.'
        : err?.message || 'Error signing in');
    alert(Array.isArray(msg) ? msg.join('\n') : msg);
  }
});
