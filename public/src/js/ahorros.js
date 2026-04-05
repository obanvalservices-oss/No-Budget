// ===== Config básica =====
(function ensureAxiosDefaults() {
  if (!axios.defaults.baseURL) axios.defaults.baseURL = '/api';
  const token = localStorage.getItem('token');
  if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
})();

document.addEventListener('DOMContentLoaded', () => {
  const hoy = new Date().toISOString().slice(0, 10);
  document.getElementById('fechaInicio').value = hoy;

  ensureEditModal();
  syncFrecuenciaRequired(document.getElementById('fijoAhorro'), document.getElementById('frecuenciaAhorro'));
  document.getElementById('fijoAhorro').addEventListener('change', () => {
    syncFrecuenciaRequired(document.getElementById('fijoAhorro'), document.getElementById('frecuenciaAhorro'));
  });

  cargarFondos();

  document.getElementById('ahorrosForm').addEventListener('submit', onSubmitCrearFondo);
  document.getElementById('listaAhorros').addEventListener('click', onListaAhorrosClick);
});

function syncFrecuenciaRequired(chk, sel) {
  if (!chk || !sel) return;
  if (chk.checked) sel.setAttribute('required', 'required');
  else sel.removeAttribute('required');
}

// ===== Crear fondo =====
async function onSubmitCrearFondo(e) {
  e.preventDefault();

  const nombre = document.getElementById('nombreFondo').value.trim();
  const meta = Number(document.getElementById('montoMeta').value);
  const aporteInicial = Number(document.getElementById('aporteInicial').value || 0);
  const montoAporteFijo = Number(document.getElementById('montoAporteFijo')?.value || 0);
  const fechaInicio = document.getElementById('fechaInicio').value;
  const frecuencia = (document.getElementById('frecuenciaAhorro').value || '').trim();
  const fijo = document.getElementById('fijoAhorro').checked;
  const tasaRaw = document.getElementById('tasaAnualPct')?.value;
  const tasaAnualPct =
    tasaRaw === undefined || String(tasaRaw).trim() === '' ? null : Number(String(tasaRaw).replace(',', '.'));
  if (tasaAnualPct !== null && Number.isNaN(tasaAnualPct)) {
    alert('La tasa anual debe ser un número (podés usar 0).');
    return;
  }

  if (!nombre || !fechaInicio) {
    alert('Completá nombre y fecha de inicio.');
    return;
  }
  if (fijo && !frecuencia) {
    alert('Si el fondo es fijo, elegí la frecuencia de aporte.');
    return;
  }

  try {
    await axios.post('/ahorros', {
      nombre,
      meta,
      fechaInicio,
      fijo,
      ...(frecuencia ? { frecuencia } : {}),
      ...(tasaAnualPct !== null ? { tasaAnualPct } : {}),
      aporte: aporteInicial,     // primer movimiento real
      aporteFijo: montoAporteFijo, // para proyección
      descripcion: nombre,       // opcional, para mostrar "Vacaciones"
    });

    e.target.reset();
    document.getElementById('fechaInicio').value = new Date().toISOString().slice(0, 10);
    await cargarFondos();
  } catch (err) {
    console.error('[ahorros] crear fondo falló', err);
    const msg = err?.response?.data?.message || 'Error al guardar fondo';
    alert(Array.isArray(msg) ? msg.join('\n') : msg);
  }
}

// ===== Listar fondos =====
async function cargarFondos() {
  const cont = document.getElementById('listaAhorros');
  cont.innerHTML = '<p>Cargando…</p>';

  try {
    const { data } = await axios.get('/ahorros?withMovs=1');
    const fondos = Array.isArray(data) ? data : [];

    if (!fondos.length) {
      cont.innerHTML = `<p class="vacio">No hay fondos registrados.</p>`;
      return;
    }

    cont.innerHTML = '';
    fondos.forEach((f) => {
      const nombre = f.nombre || f.objetivo || 'Fondo';
      const desc = f.descripcion || '';
      const baseIni = f.saldoBaseInicial != null ? Number(f.saldoBaseInicial) || 0 : 0;
      const otros =
        f.saldoOtrosAportes != null ? Number(f.saldoOtrosAportes) || 0 : Math.max(0, (Number(f.saldo) || 0) - baseIni);
      const desglose =
        baseIni > 0 || otros > 0
          ? `<p class="nb-historial-meta">Base inicial: ${money(baseIni)} · Otros aportes: ${money(otros)}</p>`
          : '';
      const pair =
        typeof window.nbHistorialPair === 'function'
          ? window.nbHistorialPair('ahorro', f.id)
          : '';
      const aportado = Number(f.saldo) || 0;
      const conRend =
        f.saldoConRendimiento != null && !Number.isNaN(Number(f.saldoConRendimiento))
          ? Number(f.saldoConRendimiento)
          : aportado;
      const tieneTasa = f.tasaAnualPct != null && Number.isFinite(Number(f.tasaAnualPct));
      const rend = Number(f.rendimientoEstimado) || 0;
      const pctStr = tieneTasa ? `${Number(f.tasaAnualPct).toLocaleString('es-ES', { maximumFractionDigits: 4 })}% a.a.` : '';
      const rendLbl = rend >= 0 ? `+${money(rend)}` : money(rend);
      const extraTasa = tieneTasa
        ? `<p class="nb-historial-meta">Tasa: ${escapeHtml(pctStr)} · Aportado: ${money(aportado)} · Rend. est.: ${rendLbl}</p>`
        : '';
      const div = document.createElement('div');
      div.className = 'nb-historial-item fondo-item';
      div.innerHTML = `
        <div class="nb-historial-body fondo-info">
          <p class="nb-historial-title">${escapeHtml(nombre)}</p>
          ${desc ? `<p class="nb-historial-meta">${escapeHtml(desc)}</p>` : ''}
          <p class="nb-historial-meta">
            Desde: ${formatFecha(f.fechaInicio || f.fechaCreacion)} · Frecuencia: ${escapeHtml(f.frecuencia || '—')}
            · Aporte fijo: ${money(f.aporteFijo || 0)} · Meta: ${money(f.meta)}
          </p>
          ${desglose}
          ${extraTasa}
        </div>
        <div class="fondo-monto-acciones" style="display:flex;align-items:center;gap:0.75rem;">
          <span class="nb-historial-amount" style="color:var(--page-accent, #2563eb);" title="${tieneTasa ? 'Saldo aportado + rendimiento estimado (tasa anual)' : 'Saldo aportado'}">${money(conRend)}</span>
          ${pair}
        </div>
      `;
      cont.appendChild(div);
    });

  } catch (err) {
    console.error('[ahorros] cargar fondos falló', err);
    cont.innerHTML = `<p class="vacio">No se pudo cargar la lista.</p>`;
  }
}

// ===== Modal de edición =====
function ensureEditModal(){
  if (document.getElementById('modalEditarAhorro')) return;
  const modal = document.createElement('div');
  modal.id = 'modalEditarAhorro';
  modal.className = 'modal-editar';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="modal-contenido">
      <h3>Editar fondo</h3>
      <form id="formEditarAhorro">
        <input type="hidden" id="editAhorroId">

        <label>Nombre</label>
        <input type="text" id="editNombre" required>

        <label>Meta ($)</label>
        <input type="number" id="editMeta" step="0.01" min="0" required>

        <label>Fecha de inicio</label>
        <input type="date" id="editFecha" required>

        <label>Frecuencia <span class="nb-muted">(obligatoria si el fondo es fijo)</span></label>
        <select id="editFrecuencia">
          <option value="">— Sin frecuencia —</option>
          <option value="semanal">Semanal</option>
          <option value="bisemanal">Bisemanal</option>
          <option value="mensual">Mensual</option>
        </select>

        <label>Monto aporte fijo ($)</label>
        <input type="number" id="editAporteFijo" step="0.01" min="0" value="0">

        <label>Tasa anual nominal (%)</label>
        <input type="number" id="editTasaAnual" step="0.01" placeholder="0 o vacío = sin tasa">

        <label style="display:flex;align-items:center;gap:.5rem;margin-top:.5rem;">
          <input type="checkbox" id="editFijo"> Fondo fijo
        </label>

        <div class="botones-modal" style="margin-top:1rem;">
          <button type="submit" class="btn-guardar">Guardar</button>
          <button type="button" id="btnCancelarEditAhorro" class="btn-cancelar">Cancelar</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('btnCancelarEditAhorro').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  document.getElementById('formEditarAhorro').addEventListener('submit', onSubmitEditarFondo);

  const editChk = document.getElementById('editFijo');
  const editSel = document.getElementById('editFrecuencia');
  editChk.addEventListener('change', () => syncFrecuenciaRequired(editChk, editSel));
}

function abrirModalEdicion(f){
  document.getElementById('editAhorroId').value = f.id;
  document.getElementById('editNombre').value   = (f.nombre || f.objetivo || '');
  document.getElementById('editMeta').value     = Number(f.meta || f.monto || 0);
  const d = f.fechaInicio || f.fechaCreacion || f.createdAt;
  document.getElementById('editFecha').value    = d ? new Date(d).toISOString().slice(0,10) : new Date().toISOString().slice(0,10);
  document.getElementById('editFrecuencia').value = (f.frecuencia || '').toLowerCase();
  document.getElementById('editAporteFijo').value = Number(f.aporteFijo || 0);
  document.getElementById('editFijo').checked   = !!f.fijo;
  const t = f.tasaAnualPct;
  document.getElementById('editTasaAnual').value =
    t != null && Number.isFinite(Number(t)) ? String(t) : '';

  syncFrecuenciaRequired(document.getElementById('editFijo'), document.getElementById('editFrecuencia'));

  document.getElementById('modalEditarAhorro').style.display = 'flex';
}

async function onListaAhorrosClick(e) {
  const btn = e.target.closest('[data-entity="ahorro"][data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  const { action } = btn.dataset;
  if (!id) return;

  if (action === 'delete') {
    if (!confirm('¿Eliminar este fondo y todos sus movimientos?')) return;
    try {
      await axios.delete(`/ahorros/${id}`);
      await cargarFondos();
    } catch (err) {
      console.error('[ahorros] eliminar falló', err);
      alert('No se pudo eliminar el fondo.');
    }
    return;
  }

  if (action === 'edit') {
    try {
      const { data } = await axios.get('/ahorros?withMovs=1');
      const fondos = Array.isArray(data) ? data : [];
      const f = fondos.find((x) => String(x.id) === String(id));
      if (!f) {
        alert('No se encontró el fondo.');
        return;
      }
      abrirModalEdicion(f);
    } catch (err) {
      console.error('[ahorros] cargar fondo para edición', err);
      alert('No se pudo cargar el fondo.');
    }
  }
}

async function onSubmitEditarFondo(e){
  e.preventDefault();
  const id        = document.getElementById('editAhorroId').value;
  const nombre    = document.getElementById('editNombre').value.trim();
  const meta      = Number(document.getElementById('editMeta').value);
  const fecha     = document.getElementById('editFecha').value;
  const frecuencia = (document.getElementById('editFrecuencia').value || '').trim();
  const aporteFijo= Number(document.getElementById('editAporteFijo').value || 0);
  const fijo      = document.getElementById('editFijo').checked;
  const tasaEditRaw = document.getElementById('editTasaAnual')?.value;
  const tasaAnualPct =
    tasaEditRaw === undefined || String(tasaEditRaw).trim() === ''
      ? null
      : Number(String(tasaEditRaw).replace(',', '.'));
  if (tasaAnualPct !== null && Number.isNaN(tasaAnualPct)) {
    alert('La tasa anual debe ser un número (podés usar 0).');
    return;
  }

  if (!nombre || !fecha) {
    alert('Nombre y fecha son requeridos.');
    return;
  }
  if (fijo && !frecuencia) {
    alert('Si el fondo es fijo, elegí la frecuencia de aporte.');
    return;
  }

  try {
    await axios.patch(`/ahorros/${id}`, {
      nombre,
      meta,
      fechaInicio: fecha,
      fijo,
      frecuencia: frecuencia || null,
      aporteFijo,
      tasaAnualPct,
      descripcion: nombre,
    });
    document.getElementById('modalEditarAhorro').style.display = 'none';
    await cargarFondos();
  } catch (err) {
    console.error('[ahorros] editar fondo falló', err);
    const msg = err?.response?.data?.message || 'No se pudo actualizar el fondo.';
    alert(Array.isArray(msg) ? msg.join('\n') : msg);
  }
}

// ===== Utils front =====
function money(n) {
  return (Number(n) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'USD' });
}
function formatFecha(v) {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(+d)) return '-';
  return d.toLocaleDateString();
}
function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
