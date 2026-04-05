// ===== Base URL + token =====
(function ensureAxiosDefaults() {
  if (!axios.defaults.baseURL) axios.defaults.baseURL = '/api';
  const t = localStorage.getItem('token');
  if (t) axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
})();

const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

// Lista amplia de zonas horarias (UTC ± offset) + ciudad de referencia
// Nota: esto es estático para front. El backend almacena el ID IANA (ej: "America/New_York").
const TIMEZONES = [
  { id: 'Pacific/Midway',           label: '(UTC-11:00) Midway' },
  { id: 'Pacific/Honolulu',         label: '(UTC-10:00) Honolulu' },
  { id: 'America/Anchorage',        label: '(UTC-09:00) Anchorage' },
  { id: 'America/Los_Angeles',      label: '(UTC-08:00) Los Ángeles' },
  { id: 'America/Phoenix',          label: '(UTC-07:00) Phoenix' },
  { id: 'America/Denver',           label: '(UTC-07:00) Denver' },
  { id: 'America/Guatemala',        label: '(UTC-06:00) Guatemala' },
  { id: 'America/Chicago',          label: '(UTC-06:00) Chicago' },
  { id: 'America/Mexico_City',      label: '(UTC-06:00) Ciudad de México' },
  { id: 'America/Bogota',           label: '(UTC-05:00) Bogotá' },
  { id: 'America/New_York',         label: '(UTC-05:00) Nueva York' },
  { id: 'America/Lima',             label: '(UTC-05:00) Lima' },
  { id: 'America/Caracas',          label: '(UTC-04:00) Caracas' },
  { id: 'America/Santiago',         label: '(UTC-04:00) Santiago' },
  { id: 'America/Asuncion',         label: '(UTC-04:00) Asunción' },
  { id: 'America/Sao_Paulo',        label: '(UTC-03:00) São Paulo' },
  { id: 'America/Montevideo',       label: '(UTC-03:00) Montevideo' },
  { id: 'America/Argentina/Buenos_Aires', label: '(UTC-03:00) Buenos Aires' },
  { id: 'Atlantic/Azores',          label: '(UTC-01:00) Azores' },
  { id: 'Atlantic/Cape_Verde',      label: '(UTC-01:00) Cabo Verde' },
  { id: 'UTC',                      label: '(UTC±00:00) UTC' },
  { id: 'Europe/Lisbon',            label: '(UTC+00:00) Lisboa' },
  { id: 'Europe/London',            label: '(UTC+00:00) Londres' },
  { id: 'Europe/Madrid',            label: '(UTC+01:00) Madrid' },
  { id: 'Europe/Paris',             label: '(UTC+01:00) París' },
  { id: 'Europe/Berlin',            label: '(UTC+01:00) Berlín' },
  { id: 'Europe/Rome',              label: '(UTC+01:00) Roma' },
  { id: 'Africa/Lagos',             label: '(UTC+01:00) Lagos' },
  { id: 'Europe/Athens',            label: '(UTC+02:00) Atenas' },
  { id: 'Africa/Cairo',             label: '(UTC+02:00) El Cairo' },
  { id: 'Europe/Istanbul',          label: '(UTC+03:00) Estambul' },
  { id: 'Europe/Moscow',            label: '(UTC+03:00) Moscú' },
  { id: 'Asia/Riyadh',              label: '(UTC+03:00) Riad' },
  { id: 'Asia/Tehran',              label: '(UTC+03:30) Teherán' },
  { id: 'Asia/Dubai',               label: '(UTC+04:00) Dubái' },
  { id: 'Asia/Karachi',             label: '(UTC+05:00) Karachi' },
  { id: 'Asia/Kolkata',             label: '(UTC+05:30) Kolkata' },
  { id: 'Asia/Dhaka',               label: '(UTC+06:00) Daca' },
  { id: 'Asia/Jakarta',             label: '(UTC+07:00) Yakarta' },
  { id: 'Asia/Bangkok',             label: '(UTC+07:00) Bangkok' },
  { id: 'Asia/Shanghai',            label: '(UTC+08:00) Shanghái' },
  { id: 'Asia/Singapore',           label: '(UTC+08:00) Singapur' },
  { id: 'Asia/Tokyo',               label: '(UTC+09:00) Tokio' },
  { id: 'Asia/Seoul',               label: '(UTC+09:00) Seúl' },
  { id: 'Australia/Perth',          label: '(UTC+08:00) Perth' },
  { id: 'Australia/Adelaide',       label: '(UTC+09:30) Adelaida' },
  { id: 'Australia/Sydney',         label: '(UTC+10:00) Sídney' },
  { id: 'Pacific/Guadalcanal',      label: '(UTC+11:00) Guadalcanal' },
  { id: 'Pacific/Auckland',         label: '(UTC+12:00) Auckland' },
];

const STATE = {
  settings: null,
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  try {
    await cargarSettings();
    buildTimezoneOptions();
    paintState();
    wireForms();
    sugerirTimeZone();
  } catch (e) {
    console.error('[settings] init error', e);
  }
}

function buildTimezoneOptions() {
  const sel = document.getElementById('timezone');
  if (!sel) return;
  sel.innerHTML = TIMEZONES.map(tz => `<option value="${tz.id}">${tz.label}</option>`).join('');
}

async function cargarSettings() {
  try {
    const { data } = await axios.get('/settings'); // devuelve settings del usuario o 404
    STATE.settings = data;
  } catch (err) {
    // si 404, creamos base
    if (err?.response?.status === 404) {
      const base = {
        weekStartDay: 1,
        weekEndDay: 7,
        currency: 'USD',
        timezone: 'UTC',
        notifications: true,
      };
      const { data } = await axios.post('/settings', base);
      STATE.settings = data;
    } else {
      console.error('[settings] no se pudo cargar', err);
      throw err;
    }
  }
}

function paintState() {
  const s = STATE.settings || {};
  const box = document.getElementById('estadoActual');
  if (box) {
    box.innerHTML = `
      <div><strong>Semana:</strong> ${DIAS[s.weekStartDay ?? 1]} → ${DIAS[(s.weekEndDay ?? 7) % 7]}</div>
      <div><strong>Moneda:</strong> ${s.currency || 'USD'}</div>
      <div><strong>Zona horaria:</strong> ${s.timezone || 'UTC'}</div>
      <div><strong>Notificaciones:</strong> ${(s.notifications ? 'Activadas' : 'Desactivadas')}</div>
    `;
  }
  // Pre-cargar formularios
  const fSemanaS = document.getElementById('weekStartDay');
  const fSemanaE = document.getElementById('weekEndDay');
  const fCurrency = document.getElementById('currency');
  const fTZ = document.getElementById('timezone');
  const fNotif = document.getElementById('notifications');

  if (fSemanaS) fSemanaS.value = String(s.weekStartDay ?? 1);
  if (fSemanaE) fSemanaE.value = String(s.weekEndDay ?? 7);
  if (fCurrency) fCurrency.value = s.currency || 'USD';
  if (fTZ) fTZ.value = s.timezone || 'UTC';
  if (fNotif) fNotif.checked = !!s.notifications;
}

function wireForms() {
  // Semana
  document.getElementById('formSemana')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const weekStartDay = Number(document.getElementById('weekStartDay').value);
    const weekEndDay   = Number(document.getElementById('weekEndDay').value);
    try {
      const { data } = await axios.patch('/settings', { weekStartDay, weekEndDay });
      STATE.settings = { ...STATE.settings, ...data };
      paintState();
      alert('Preferencias de semana guardadas.');
    } catch (err) {
      console.error('[settings] error al guardar semana', err);
      alert('No se pudo guardar. Intenta de nuevo.');
    }
  });

  // Generales
  document.getElementById('formGeneral')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currency = document.getElementById('currency').value;
    const timezone = document.getElementById('timezone').value;
    const notifications = document.getElementById('notifications').checked;
    try {
      const { data } = await axios.patch('/settings', { currency, timezone, notifications });
      STATE.settings = { ...STATE.settings, ...data };
      paintState();
      alert('Preferencias guardadas.');
    } catch (err) {
      console.error('[settings] error al guardar generales', err);
      alert('No se pudo guardar. Intenta de nuevo.');
    }
  });

  // Detectar zona
  document.getElementById('btnDetectarTZ')?.addEventListener('click', () => {
    sugerirTimeZone(true);
  });

  // Seguridad (cambio de contraseña)
  document.getElementById('formPassword')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPassword').value.trim();
    const newPassword = document.getElementById('newPassword').value.trim();
    if (!currentPassword || !newPassword) return alert('Completa ambos campos.');
    try {
      await axios.patch('/settings/password', { currentPassword, newPassword });
      (document.getElementById('currentPassword').value = '');
      (document.getElementById('newPassword').value = '');
      alert('Contraseña actualizada.');
    } catch (err) {
      const msg = err?.response?.data?.message || 'No se pudo actualizar la contraseña.';
      alert(Array.isArray(msg) ? msg.join('\n') : msg);
    }
  });
}

// Sugerencia de zona horaria
function sugerirTimeZone(aplicar = false) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const hint = document.getElementById('tzHint');
  if (hint) hint.textContent = `Sugerencia automática: ${tz}`;
  if (aplicar) {
    const sel = document.getElementById('timezone');
    if (sel) {
      // Si existe en lista, selecciónalo; si no, agrega opción dinámica y selecciónala
      const exists = Array.from(sel.options).some(o => o.value === tz);
      if (!exists) {
        const opt = document.createElement('option');
        opt.value = tz;
        opt.textContent = `(auto) ${tz}`;
        sel.appendChild(opt);
      }
      sel.value = tz;
    }
  }
}
