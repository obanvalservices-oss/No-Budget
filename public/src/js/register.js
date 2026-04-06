// Cash_Future/src/js/register.js
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const nombre = (document.getElementById('nombre') || document.getElementById('name'))?.value?.trim() || '';
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const confirm = (
    document.getElementById('confirm-password') ||
    document.getElementById('confirm') ||
    document.getElementById('passwordConfirm')
  )?.value?.trim();

  if (!email || !password) return alert('Correo y contraseña son obligatorios.');
  if (confirm !== undefined && password !== confirm) return alert('Las contraseñas no coinciden.');

  try {
    const { data } = await axios.post('/auth/register', {
      nombre: nombre || undefined,
      name: nombre || undefined,
      email,
      password,
    });

    const token = data.token || data.access_token;
    if (token) {
      localStorage.setItem('token', token);
      if (data.user) {
        const user = { id: data.user.id, nombre: data.user.nombre || data.user.name || '', email: data.user.email };
        localStorage.setItem('user', JSON.stringify(user));
      }
      // ruta absoluta
      window.location.href = '/src/dashboard/home.html';
      return;
    }

    // si no vino token, ir a login
    window.location.href = '/src/login.html';
  } catch (err) {
    const msg =
      err?.response?.data?.message ||
      (err?.message === 'Network Error' ? 'No se puede conectar con el servidor.' : err?.message) ||
      'No se pudo registrar. Verifica los datos.';
    alert(Array.isArray(msg) ? msg.join('\n') : msg);
  }
});
