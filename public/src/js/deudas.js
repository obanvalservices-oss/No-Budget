// ==================== deudas.js ====================
// Base URL + token
(function ensureAxiosDefaults() {
  if (!axios.defaults.baseURL) axios.defaults.baseURL = '/api';
  const token = localStorage.getItem('token');
  if (token && !axios.defaults.headers.common['Authorization']) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
})();

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const money = (n) =>
  (Number(n) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const fdate = (v) => {
  const d = new Date(v);
  if (Number.isNaN(+d)) return '-';
  return d.toLocaleDateString();
};

// Estado en memoria
const STATE = {
  savings: [], // fondos de ahorro para selects
};

// Init
document.addEventListener('DOMContentLoaded', async () => {
  // Defaults de fecha
  const hoy = new Date().toISOString().slice(0, 10);
  $('#startDate').value = hoy;
  $('#firstDueDate').value = hoy;

  // Listeners UI
  bindUiToggles();
  bindForm();

  // Datos requeridos
  await loadSavingsOptions();
  await reloadHistory(); // 👈 carga inicial del listado

  $('.deudas-container').addEventListener('click', onDeudaHistoryClick);
});

// ---------- UI toggles ----------
function bindUiToggles() {
  const hasInstallments = $('#hasInstallments');
  const campoCuotas = $('#campoCuotas');

  hasInstallments.addEventListener('change', () => {
    if (hasInstallments.checked) {
      campoCuotas.classList.remove('hidden');
    } else {
      campoCuotas.classList.add('hidden');
      // limpiar campos de cuotas
      $('#installmentsCount').value = '';
      $('#frequency').value = 'mensual';
      $('#firstDueDate').value = new Date().toISOString().slice(0, 10);
    }
  });

  // Pago inicial: si SAVINGS mostrar fondo
  const downSource = $('#downSource');
  const downSavingsWrap = $('#downSavingsWrap'); // ojo: existe con id
  downSource.addEventListener('change', () => {
    const v = downSource.value;
    if (v === 'SAVINGS') downSavingsWrap.classList.remove('hidden');
    else downSavingsWrap.classList.add('hidden');
  });

  // Cuotas: si SAVINGS mostrar fondo
  const instSource = $('#installmentsSource');
  const instSavingsWrap = $('#instSavingsWrap');
  instSource.addEventListener('change', () => {
    const v = instSource.value;
    if (v === 'SAVINGS') instSavingsWrap.classList.remove('hidden');
    else instSavingsWrap.classList.add('hidden');
  });

  // Tabs History
  $$('.tabs .tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.tabs .tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab; // act | inact
      if (tab === 'act') {
        $('#listActive').classList.remove('hidden');
        $('#listInactive').classList.add('hidden');
      } else {
        $('#listInactive').classList.remove('hidden');
        $('#listActive').classList.add('hidden');
      }
    });
  });

  // Botón limpiar
  $('#btnReset').addEventListener('click', () => {
    $('#formDeuda').reset();
    $('#startDate').value = new Date().toISOString().slice(0, 10);
    $('#firstDueDate').value = new Date().toISOString().slice(0, 10);
    // Esconder wrappers condicionales
    $('#campoCuotas').classList.add('hidden');
    $('#downSavingsWrap').classList.add('hidden');
    $('#instSavingsWrap').classList.add('hidden');
  });
}

// ---------- Load fondos de ahorro para selects ----------
async function loadSavingsOptions() {
  try {
    const { data } = await axios.get('/ahorros'); // asumiendo GET /ahorros lista fondos
    STATE.savings = Array.isArray(data) ? data : [];
    // Pago inicial
    const downSel = $('#downSavings');
    downSel.innerHTML = STATE.savings
      .map((f) => `<option value="${f.id}">${escapeHtml(f.nombre || 'Fund')} — Balance ${money(f.saldo || 0)}</option>`)
      .join('');
    // Cuotas
    const instSel = $('#instSavings');
    instSel.innerHTML = STATE.savings
      .map((f) => `<option value="${f.id}">${escapeHtml(f.nombre || 'Fund')} — Balance ${money(f.saldo || 0)}</option>`)
      .join('');
    // Hints
    $('#downSavingsHint').textContent = 'Will be debited from the selected fund balance.';
    $('#instSavingsHint').textContent = 'Each installment will be debited from the selected fund.';
  } catch (e) {
    console.error('[deudas] no se pudieron cargar fondos', e);
    STATE.savings = [];
  }
}

// ---------- Form Submit ----------
function bindForm() {
  $('#formDeuda').addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = $('#title').value.trim();
    const principal = Number($('#principal').value);
    const startDate = $('#startDate').value;
    const description = $('#description').value.trim() || null;

    const hasInstallments = $('#hasInstallments').checked;
    const installmentsCount = hasInstallments ? Number($('#installmentsCount').value) : undefined;
    const frequency = hasInstallments ? $('#frequency').value : null;
    const firstDueDate = hasInstallments ? $('#firstDueDate').value : null;

    const downPayment = Number($('#downPayment').value || 0);
    const downSource = $('#downSource').value; // NONE | INGRESO | SAVINGS
    const downSavings = $('#downSavings').value ? Number($('#downSavings').value) : undefined;

    const installmentsSource = $('#installmentsSource').value; // INGRESO | SAVINGS
    const instSavings = $('#instSavings').value ? Number($('#instSavings').value) : undefined;

    if (!title || !principal || !startDate) {
      return alert('Complete Title, Total amount, and Start date.');
    }

    // Validaciones de ahorro cuando se usa SAVINGS
    if (downSource === 'SAVINGS' && downPayment > 0) {
      const f = STATE.savings.find((x) => x.id === downSavings);
      if (!f) return alert('Select a valid fund for the down payment.');
      if ((Number(f.saldo) || 0) < downPayment) {
        return alert('The selected fund does not have enough balance for the down payment.');
      }
    }
    if (hasInstallments && installmentsSource === 'SAVINGS') {
      if (!instSavings) return alert('Select a fund to pay installments.');
      const f2 = STATE.savings.find((x) => x.id === instSavings);
      if (!f2) return alert('Select a valid fund for installments.');
    }

    const payload = {
      title,
      description,
      principal,
      startDate,
      // cuotas
      hasInstallments,
      installmentsCount: hasInstallments ? installmentsCount : undefined,
      frequency: hasInstallments ? frequency : null,
      firstDueDate: hasInstallments ? firstDueDate : null,
      // fuentes
      downPayment,
      downSource,
      downSavings: downSource === 'SAVINGS' ? downSavings : undefined,
      installmentsSource,
      instSavings: installmentsSource === 'SAVINGS' ? instSavings : undefined,
    };

    try {
      const { data } = await axios.post('/deudas', payload);
      console.log('[deudas] creada →', data);
      alert('✅ Debt saved successfully.');
      $('#formDeuda').reset();
      // Restablecer fechas y ocultar condicionales
      $('#startDate').value = new Date().toISOString().slice(0, 10);
      $('#firstDueDate').value = new Date().toISOString().slice(0, 10);
      $('#campoCuotas').classList.add('hidden');
      $('#downSavingsWrap').classList.add('hidden');
      $('#instSavingsWrap').classList.add('hidden');

      await reloadHistory(); // 👈 refrescar listado tras crear
    } catch (e) {
      console.error('[deudas] error al guardar', e);
      const msg = e?.response?.data?.message || 'Could not save debt.';
      alert(Array.isArray(msg) ? msg.join('\n') : msg);
    }
  });
}

// ---------- History ----------
async function reloadHistory() {
  try {
    const res = await axios.get('/deudas');
    // Debug
    console.log('[debug] GET /deudas → status:', res.status, 'payload:', res.data);
    const data = Array.isArray(res.data) ? res.data : [];

    // Split en activas/inactivas por status
    const activas = data.filter((d) => (d.status || '').toUpperCase() === 'ACTIVA');
    const inactivas = data.filter((d) => (d.status || '').toUpperCase() !== 'ACTIVA');

    // Pintar
    paintDebtList('#listActive', activas, 'No active debts.');
    paintDebtList('#listInactive', inactivas, 'No inactive debts.');
  } catch (e) {
    console.error('[deudas] error al cargar historial', e);
    paintDebtList('#listActive', [], 'Could not load list.');
    paintDebtList('#listInactive', [], '');
  }
}

function paintDebtList(containerSel, items, emptyText) {
  const cont = $(containerSel);
  if (!cont) return;

  if (!items || items.length === 0) {
    cont.innerHTML = `<p class="vacio">${escapeHtml(emptyText || 'No results')}</p>`;
    return;
  }

  cont.innerHTML = items
    .map((d) => debtItemHtml(d))
    .join('');
}

function debtItemHtml(d) {
  const saldo = Number(d.saldoPend ?? d.saldo ?? 0);
  const pagado = Number(d.pagado ?? 0);
  const freq = (d.frequency || '').toLowerCase() || '—';
  const cuotas = d.installmentsCount ? `${d.installmentsCount}` : '—';
  const estado = (d.status || '').toUpperCase();
  const pagos = Array.isArray(d.pagos) ? d.pagos : [];
  const pair =
    typeof window.nbHistoryPair === 'function'
      ? window.nbHistoryPair('deuda', d.id)
      : '';

  return `
    <div class="debt-row nb-historial-item">
      <div class="nb-historial-body debt-main">
        <p class="nb-historial-title">${escapeHtml(d.title || 'Debt')}</p>
        <p class="nb-historial-meta">
          Started: ${fdate(d.startDate)} · Frequency: ${escapeHtml(freq)} · Cuotas: ${cuotas}
          ${d.description ? ` · ${escapeHtml(d.description)}` : ''}
        </p>
      </div>
      <div class="debt-money-actions">
        <div class="debt-money">
          <div>Total: ${money(d.principal)}</div>
          <div>Paid: ${money(pagado)}</div>
          <div><strong>Pending: ${money(saldo)}</strong></div>
          <div class="badge ${estado === 'ACTIVA' ? 'ok' : 'off'}">${estado}</div>
        </div>
        ${pair}
      </div>

      ${pagos.length ? `
      <div class="debt-pagos">
        <details>
          <summary>Payments (${pagos.length})</summary>
          <ul>
            ${pagos.map(p => `
              <li>${fdate(p.fecha)} — ${money(p.monto)} ${p.fuente ? `• ${escapeHtml(p.fuente)}` : ''}</li>
            `).join('')}
          </ul>
        </details>
      </div>` : ''}
    </div>
  `;
}

async function onDeudaHistoryClick(e) {
  const btn = e.target.closest('[data-entity="deuda"][data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  const { action } = btn.dataset;
  if (!id) return;

  if (action === 'delete') {
    if (!confirm('Delete this debt and its payments?')) return;
    try {
      await axios.delete(`/deudas/${id}`);
      await reloadHistory();
    } catch (err) {
      console.error('[deudas] error al eliminar', err);
      alert('Could not delete record.');
    }
    return;
  }

  if (action === 'edit') {
    let row;
    try {
      const res = await axios.get('/deudas');
      const data = Array.isArray(res.data) ? res.data : [];
      row = data.find((x) => String(x.id) === String(id));
    } catch (err) {
      console.error('[deudas] error al cargar deuda', err);
      alert('Could not load debt.');
      return;
    }
    if (!row) {
      alert('Debt not found.');
      return;
    }

    const newTitle = prompt('Title:', row.title || '') ?? '';
    if (newTitle === '') return;
    const newDesc = prompt('Description (optional):', row.description || '') ?? '';
    const newPrincipalStr = prompt('Total amount:', String(row.principal ?? '')) ?? '';

    const payload = {
      title: newTitle.trim(),
      description: newDesc.trim() || null,
    };
    if (newPrincipalStr.trim() && !Number.isNaN(Number(newPrincipalStr))) {
      payload.principal = Number(newPrincipalStr);
    }

    try {
      await axios.patch(`/deudas/${id}`, payload);
      await reloadHistory();
    } catch (err) {
      console.error('[deudas] error al editar', err);
      const msg = err?.response?.data?.message || 'Could not edit debt.';
      alert(Array.isArray(msg) ? msg.join('\n') : msg);
    }
  }
}

// ---------- Utils ----------
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
