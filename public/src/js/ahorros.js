// ===== Config básica =====
(function ensureAxiosDefaults() {
  if (!axios.defaults.baseURL) axios.defaults.baseURL = '/api';
  const token = localStorage.getItem('token');
  if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
})();

document.addEventListener('DOMContentLoaded', () => {
  const hoy = new Date().toISOString().slice(0, 10);
  document.getElementById('fechaHome').value = hoy;

  ensureEditModal();
  syncFrequencyRequired(document.getElementById('fijoAhorro'), document.getElementById('frecuenciaAhorro'));
  document.getElementById('fijoAhorro').addEventListener('change', () => {
    syncFrequencyRequired(document.getElementById('fijoAhorro'), document.getElementById('frecuenciaAhorro'));
  });

  cargarFondos();

  document.getElementById('ahorrosForm').addEventListener('submit', onSubmitCreateFondo);
  document.getElementById('listaAhorros').addEventListener('click', onListaAhorrosClick);
});

function syncFrequencyRequired(chk, sel) {
  if (!chk || !sel) return;
  if (chk.checked) sel.setAttribute('required', 'required');
  else sel.removeAttribute('required');
}

// ===== Create fondo =====
async function onSubmitCreateFondo(e) {
  e.preventDefault();

  const nombre = document.getElementById('nombreFondo').value.trim();
  const meta = Number(document.getElementById('montoMeta').value);
  const aporteInicial = Number(document.getElementById('aporteInicial').value || 0);
  const montoAporteFijo = Number(document.getElementById('montoAporteFijo')?.value || 0);
  const fechaHome = document.getElementById('fechaHome').value;
  const frecuencia = (document.getElementById('frecuenciaAhorro').value || '').trim();
  const fijo = document.getElementById('fijoAhorro').checked;
  const tasaRaw = document.getElementById('tasaAnnualPct')?.value;
  const tasaAnnualPct =
    tasaRaw === undefined || String(tasaRaw).trim() === '' ? null : Number(String(tasaRaw).replace(',', '.'));
  if (tasaAnnualPct !== null && Number.isNaN(tasaAnnualPct)) {
    alert('Annual rate must be a number (you can use 0).');
    return;
  }

  if (!nombre || !fechaHome) {
    alert('Complete name and start date.');
    return;
  }
  if (fijo && !frecuencia) {
    alert('If the fund is fixed, choose contribution frequency.');
    return;
  }

  try {
    await axios.post('/ahorros', {
      nombre,
      meta,
      fechaHome,
      fijo,
      ...(frecuencia ? { frecuencia } : {}),
      ...(tasaAnnualPct !== null ? { tasaAnnualPct } : {}),
      aporte: aporteInicial,     // primer movimiento real
      aporteFijo: montoAporteFijo, // para proyección
      descripcion: nombre,       // opcional, para mostrar "Vacaciones"
    });

    e.target.reset();
    document.getElementById('fechaHome').value = new Date().toISOString().slice(0, 10);
    await cargarFondos();
  } catch (err) {
    console.error('[ahorros] crear fondo falló', err);
    const msg = err?.response?.data?.message || 'Error saving fund';
    alert(Array.isArray(msg) ? msg.join('\n') : msg);
  }
}

// ===== Listar fondos =====
async function cargarFondos() {
  const cont = document.getElementById('listaAhorros');
  cont.innerHTML = '<p>Loading…</p>';

  try {
    const { data } = await axios.get('/ahorros?withMovs=1');
    const fondos = Array.isArray(data) ? data : [];

    if (!fondos.length) {
      cont.innerHTML = `<p class="vacio">No funds registered.</p>`;
      return;
    }

    cont.innerHTML = '';
    fondos.forEach((f) => {
      const nombre = f.nombre || f.objetivo || 'Fund';
      const desc = f.descripcion || '';
      const baseIni = f.saldoBaseInicial != null ? Number(f.saldoBaseInicial) || 0 : 0;
      const otros =
        f.saldoOtrosAportes != null ? Number(f.saldoOtrosAportes) || 0 : Math.max(0, (Number(f.saldo) || 0) - baseIni);
      const desglose =
        baseIni > 0 || otros > 0
          ? `<p class="nb-historial-meta">Initial base: ${money(baseIni)} · Other contributions: ${money(otros)}</p>`
          : '';
      const pair =
        typeof window.nbHistoryPair === 'function'
          ? window.nbHistoryPair('ahorro', f.id)
          : '';
      const aportado = Number(f.saldo) || 0;
      const conRend =
        f.saldoConRendimiento != null && !Number.isNaN(Number(f.saldoConRendimiento))
          ? Number(f.saldoConRendimiento)
          : aportado;
      const tieneTasa = f.tasaAnnualPct != null && Number.isFinite(Number(f.tasaAnnualPct));
      const rend = Number(f.rendimientoEstimado) || 0;
      const pctStr = tieneTasa ? `${Number(f.tasaAnnualPct).toLocaleString('en-US', { maximumFractionDigits: 4 })}% p.a.` : '';
      const rendLbl = rend >= 0 ? `+${money(rend)}` : money(rend);
      const extraTasa = tieneTasa
        ? `<p class="nb-historial-meta">Rate: ${escapeHtml(pctStr)} · Contributed: ${money(aportado)} · Est. return: ${rendLbl}</p>`
        : '';
      const div = document.createElement('div');
      div.className = 'nb-historial-item fondo-item';
      div.innerHTML = `
        <div class="nb-historial-body fondo-info">
          <p class="nb-historial-title">${escapeHtml(nombre)}</p>
          ${desc ? `<p class="nb-historial-meta">${escapeHtml(desc)}</p>` : ''}
          <p class="nb-historial-meta">
            Since: ${formatFecha(f.fechaHome || f.fechaCreacion)} · Frequency: ${escapeHtml(f.frecuencia || '—')}
            · Fixed contribution: ${money(f.aporteFijo || 0)} · Goal: ${money(f.meta)}
          </p>
          ${desglose}
          ${extraTasa}
        </div>
        <div class="fondo-monto-acciones" style="display:flex;align-items:center;gap:0.75rem;">
          <span class="nb-historial-amount" style="color:var(--page-accent, #2563eb);" title="${tieneTasa ? 'Contributed balance + estimated return (annual rate)' : 'Contributed balance'}">${money(conRend)}</span>
          ${pair}
        </div>
      `;
      cont.appendChild(div);
    });

  } catch (err) {
    console.error('[ahorros] cargar fondos falló', err);
    cont.innerHTML = `<p class="vacio">Could not load list.</p>`;
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
      <h3>Edit fund</h3>
      <form id="formEditarAhorro">
        <input type="hidden" id="editAhorroId">

        <label>Name</label>
        <input type="text" id="editNombre" required>

        <label>Meta ($)</label>
        <input type="number" id="editMeta" step="0.01" min="0" required>

        <label>Start date</label>
        <input type="date" id="editFecha" required>

        <label>Frequency <span class="nb-muted">(required if fund is fixed)</span></label>
        <select id="editFrequency">
          <option value="">— No frequency —</option>
          <option value="semanal">Weekly</option>
          <option value="bisemanal">Biweekly</option>
          <option value="mensual">Monthly</option>
        </select>

        <label>Fixed contribution amount ($)</label>
        <input type="number" id="editAporteFijo" step="0.01" min="0" value="0">

        <label>Nominal annual rate (%)</label>
        <input type="number" id="editTasaAnnual" step="0.01" placeholder="0 or empty = no rate">

        <label style="display:flex;align-items:center;gap:.5rem;margin-top:.5rem;">
          <input type="checkbox" id="editFijo"> Fixed fund
        </label>

        <div class="botones-modal" style="margin-top:1rem;">
          <button type="submit" class="btn-guardar">Save</button>
          <button type="button" id="btnCancelEditAhorro" class="btn-cancelar">Cancel</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('btnCancelEditAhorro').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  document.getElementById('formEditarAhorro').addEventListener('submit', onSubmitEditarFondo);

  const editChk = document.getElementById('editFijo');
  const editSel = document.getElementById('editFrequency');
  editChk.addEventListener('change', () => syncFrequencyRequired(editChk, editSel));
}

function abrirModalEdicion(f){
  document.getElementById('editAhorroId').value = f.id;
  document.getElementById('editNombre').value   = (f.nombre || f.objetivo || '');
  document.getElementById('editMeta').value     = Number(f.meta || f.monto || 0);
  const d = f.fechaHome || f.fechaCreacion || f.createdAt;
  document.getElementById('editFecha').value    = d ? new Date(d).toISOString().slice(0,10) : new Date().toISOString().slice(0,10);
  document.getElementById('editFrequency').value = (f.frecuencia || '').toLowerCase();
  document.getElementById('editAporteFijo').value = Number(f.aporteFijo || 0);
  document.getElementById('editFijo').checked   = !!f.fijo;
  const t = f.tasaAnnualPct;
  document.getElementById('editTasaAnnual').value =
    t != null && Number.isFinite(Number(t)) ? String(t) : '';

  syncFrequencyRequired(document.getElementById('editFijo'), document.getElementById('editFrequency'));

  document.getElementById('modalEditarAhorro').style.display = 'flex';
}

async function onListaAhorrosClick(e) {
  const btn = e.target.closest('[data-entity="ahorro"][data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  const { action } = btn.dataset;
  if (!id) return;

  if (action === 'delete') {
    if (!confirm('Delete this fund and all its transactions?')) return;
    try {
      await axios.delete(`/ahorros/${id}`);
      await cargarFondos();
    } catch (err) {
      console.error('[ahorros] eliminar falló', err);
      alert('Could not delete fund.');
    }
    return;
  }

  if (action === 'edit') {
    try {
      const { data } = await axios.get('/ahorros?withMovs=1');
      const fondos = Array.isArray(data) ? data : [];
      const f = fondos.find((x) => String(x.id) === String(id));
      if (!f) {
        alert('Fund not found.');
        return;
      }
      abrirModalEdicion(f);
    } catch (err) {
      console.error('[ahorros] cargar fondo para edición', err);
      alert('Could not load fund.');
    }
  }
}

async function onSubmitEditarFondo(e){
  e.preventDefault();
  const id        = document.getElementById('editAhorroId').value;
  const nombre    = document.getElementById('editNombre').value.trim();
  const meta      = Number(document.getElementById('editMeta').value);
  const fecha     = document.getElementById('editFecha').value;
  const frecuencia = (document.getElementById('editFrequency').value || '').trim();
  const aporteFijo= Number(document.getElementById('editAporteFijo').value || 0);
  const fijo      = document.getElementById('editFijo').checked;
  const tasaEditRaw = document.getElementById('editTasaAnnual')?.value;
  const tasaAnnualPct =
    tasaEditRaw === undefined || String(tasaEditRaw).trim() === ''
      ? null
      : Number(String(tasaEditRaw).replace(',', '.'));
  if (tasaAnnualPct !== null && Number.isNaN(tasaAnnualPct)) {
    alert('Annual rate must be a number (you can use 0).');
    return;
  }

  if (!nombre || !fecha) {
    alert('Name and date are required.');
    return;
  }
  if (fijo && !frecuencia) {
    alert('If the fund is fixed, choose contribution frequency.');
    return;
  }

  try {
    await axios.patch(`/ahorros/${id}`, {
      nombre,
      meta,
      fechaHome: fecha,
      fijo,
      frecuencia: frecuencia || null,
      aporteFijo,
      tasaAnnualPct,
      descripcion: nombre,
    });
    document.getElementById('modalEditarAhorro').style.display = 'none';
    await cargarFondos();
  } catch (err) {
    console.error('[ahorros] editar fondo falló', err);
    const msg = err?.response?.data?.message || 'Could not update el fondo.';
    alert(Array.isArray(msg) ? msg.join('\n') : msg);
  }
}

// ===== Utils front =====
function money(n) {
  return (Number(n) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
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
