(function ensureAxiosDefaults() {
  if (!axios.defaults.baseURL) axios.defaults.baseURL = '/api';
  const token = localStorage.getItem('token');
  if (token) axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
})();

const TIPO_LABELS = {
  acciones: 'Acciones',
  criptomonedas: 'Criptomonedas',
  'bienes-raices': 'Bienes raíces',
  fondos: 'Fondos',
  bonos: 'Bonos',
  retiro: 'Planes de retiro',
  otros: 'Otros',
};

/**
 * Sugerencias por tipo (datalist): el usuario puede elegir o escribir cualquier texto.
 * `cotizable`: tiene mapa a símbolo en servidor para cotización automática.
 */
const ACTIVOS_PRESETS = {
  acciones: [
    { nombre: 'Apple', cotizable: true },
    { nombre: 'Amazon', cotizable: true },
    { nombre: 'Meta', cotizable: true },
  ],
  criptomonedas: [
    { nombre: 'Bitcoin', cotizable: true },
    { nombre: 'Ethereum', cotizable: true },
  ],
  'bienes-raices': [
    { nombre: 'Departamento' },
    { nombre: 'Local comercial' },
    { nombre: 'Terreno' },
  ],
  fondos: [{ nombre: 'ETF indexado' }, { nombre: 'Fondo mutuo' }, { nombre: 'Mercado de dinero' }],
  bonos: [{ nombre: 'Bono corporativo' }, { nombre: 'Bono soberano' }, { nombre: 'Letes / similar' }],
  retiro: [{ nombre: 'Plan 401(k) / similar' }, { nombre: 'IRA / retiro individual' }, { nombre: 'Sistema público / AFJP' }],
  otros: [],
};

let selectedTipo = '';
let cotizTimer = null;
/** Última respuesta de /inversiones/cotizacion (solo para texto en formulario). */
let ultimaCotizacion = null;

document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('#tipoInversionTabs .tab');
  const activoInput = document.getElementById('activoInput');
  const cantidadInput = document.getElementById('cantidad');
  const precioCompraInput = document.getElementById('precioCompra');
  const simboloMercado = document.getElementById('simboloMercado');
  const capitalInvertido = document.getElementById('capitalInvertido');
  const listaInversiones = document.getElementById('listaInversiones');
  const hint = document.getElementById('tipoInversionHint');

  fillEditTipoSelect();

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      applyTipo(tab.dataset.tipo);
    });
  });

  activoInput.addEventListener('input', () => scheduleCotizacionPreview());
  activoInput.addEventListener('change', () => scheduleCotizacionPreview());
  simboloMercado.addEventListener('input', () => scheduleCotizacionPreview());
  capitalInvertido.addEventListener('input', () => updateResultadoEstimado());
  cantidadInput.addEventListener('input', () => updateResultadoEstimado());
  precioCompraInput.addEventListener('input', () => updateResultadoEstimado());

  document.getElementById('formInversion').addEventListener('submit', onSubmitInversion);

  listaInversiones.addEventListener('click', onListaInversionesClick);

  const modal = document.getElementById('modalEditarInversion');
  document.getElementById('btnCancelarEditInv').addEventListener('click', () => {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
  });
  document.getElementById('formEditarInversion').addEventListener('submit', onSubmitEditarInversion);

  const wrap = document.getElementById('activoUnifiedWrap');
  if (wrap) wrap.style.display = 'none';
  if (hint) hint.textContent = 'Elegí un tipo de inversión arriba.';

  cargarInversiones();
});

function fillEditTipoSelect() {
  const sel = document.getElementById('editInvTipo');
  if (!sel || sel.options.length) return;
  sel.innerHTML = '';
  Object.entries(TIPO_LABELS).forEach(([k, label]) => {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = label;
    sel.appendChild(o);
  });
}

function getActivoNombre() {
  const el = document.getElementById('activoInput');
  return el ? el.value.trim() : '';
}

function fillActivosDatalist(tipoKey) {
  const dl = document.getElementById('activosDatalist');
  if (!dl) return;
  dl.innerHTML = '';
  const presetList = ACTIVOS_PRESETS[tipoKey] || [];
  presetList.forEach((a) => {
    const opt = document.createElement('option');
    opt.value = a.nombre;
    dl.appendChild(opt);
  });
}

function activoPareceTicker(activo) {
  const x = (activo || '').trim();
  if (x.length < 2 || x.length > 20) return false;
  if (/\s/.test(x)) return false;
  return /^[A-Za-z0-9][A-Za-z0-9./-]*$/.test(x);
}

/** Preset cotizable (Apple, Bitcoin…) o ticker tipeado (FXAIX, BTC/USD…). */
function activoTieneMapaCotizacion(activo) {
  if (activoPareceTicker(activo)) return true;
  const list = ACTIVOS_PRESETS[selectedTipo] || [];
  const t = (activo || '').trim().toLowerCase();
  return list.some((a) => a.nombre.toLowerCase() === t && a.cotizable === true);
}

function applyTipo(tipoKey) {
  selectedTipo = tipoKey;
  const wrap = document.getElementById('activoUnifiedWrap');
  const input = document.getElementById('activoInput');
  const hint = document.getElementById('tipoInversionHint');
  const subHint = document.getElementById('activoInputHint');

  if (wrap && input) {
    wrap.style.display = 'block';
    input.value = '';
    fillActivosDatalist(tipoKey);
  }

  const n = (ACTIVOS_PRESETS[tipoKey] || []).length;
  if (subHint) {
    subHint.textContent =
      n > 0
        ? 'Escribí el nombre o elegí una sugerencia (lista desplegable del navegador).'
        : 'Escribí el nombre del activo; no hay sugerencias fijas para este tipo.';
  }

  if (hint) {
    hint.textContent = `Tipo: ${TIPO_LABELS[tipoKey] || tipoKey}. Podés tipear o seleccionar activo. Capital inicial usa cotización del día si hay símbolo.`;
  }
  scheduleCotizacionPreview();
}

function scheduleCotizacionPreview() {
  clearTimeout(cotizTimer);
  cotizTimer = setTimeout(() => fetchCotizacionPreview(), 450);
}

async function fetchCotizacionPreview() {
  const el = document.getElementById('valorMercado');
  if (!selectedTipo) {
    el.textContent = 'Cotización: —';
    ultimaCotizacion = null;
    updateResultadoEstimado();
    return;
  }

  const activo = getActivoNombre();
  const simbolo = document.getElementById('simboloMercado').value.trim();
  if (!activo && !simbolo) {
    el.textContent = 'Cotización: indicá activo o símbolo';
    ultimaCotizacion = null;
    updateResultadoEstimado();
    return;
  }

  el.textContent = 'Cotización: cargando…';
  try {
    let url = `/inversiones/cotizacion?tipo=${encodeURIComponent(selectedTipo)}&activo=${encodeURIComponent(activo)}`;
    if (simbolo) url += `&simbolo=${encodeURIComponent(simbolo)}`;
    const { data } = await axios.get(url);
    if (data.ok) {
      ultimaCotizacion = data;
      const prev =
        data.previousClose != null && !Number.isNaN(Number(data.previousClose))
          ? money(data.previousClose)
          : '—';
      el.textContent = `${data.symbol}: ${money(data.close)} · prev. ${prev} · ${data.quoteDate} (${data.source})`;
    } else {
      ultimaCotizacion = null;
      el.textContent = `Cotización: ${data.message || 'no disponible'}`;
    }
  } catch (err) {
    console.warn('[inversiones] cotizacion preview', err);
    ultimaCotizacion = null;
    el.textContent = 'Cotización: error de red';
  }
  updateResultadoEstimado();
}

function updateResultadoEstimado() {
  const resultadoInversion = document.getElementById('resultadoInversion');
  const cap = parseFloat(document.getElementById('capitalInvertido').value);
  if (ultimaCotizacion && ultimaCotizacion.ok && cap > 0 && ultimaCotizacion.close > 0) {
    const acciones = cap / ultimaCotizacion.close;
    resultadoInversion.textContent = `Con este capital y el precio mostrado arriba → ~${acciones.toFixed(6)} acciones/unidades al registrar.`;
    resultadoInversion.className = 'nb-historial-meta';
    return;
  }
  const cant = parseFloat(document.getElementById('cantidad').value);
  const pc = parseFloat(document.getElementById('precioCompra').value);
  if (cant > 0 && pc > 0) {
    resultadoInversion.textContent = `Capital manual implícito: ${money(cant * pc)}`;
    resultadoInversion.className = 'nb-historial-meta';
    return;
  }
  resultadoInversion.textContent = '';
  resultadoInversion.className = '';
}

async function onSubmitInversion(e) {
  e.preventDefault();
  if (!selectedTipo) {
    alert('Elegí un tipo de inversión (pestaña superior).');
    return;
  }

  const activo = getActivoNombre();
  if (!activo) {
    alert('Indicá el activo (escribiendo o eligiendo de la lista).');
    return;
  }

  const descripcion = (document.getElementById('descripcion').value || '').trim();
  const simboloExtra = document.getElementById('simboloMercado').value.trim();

  const capital = parseFloat(document.getElementById('capitalInvertido').value);
  const cantidad = parseFloat(document.getElementById('cantidad').value);
  const precioCompra = parseFloat(document.getElementById('precioCompra').value);
  const planM = parseFloat(document.getElementById('planAporteMonto').value);
  const planF = document.getElementById('planAporteFrecuencia').value.trim();
  const planIni = (document.getElementById('planAporteInicio').value || '').trim();

  const categoria = TIPO_LABELS[selectedTipo] || selectedTipo;
  const body = {
    tipo: selectedTipo,
    activo,
    categoria,
    descripcion: descripcion || undefined,
  };

  if (simboloExtra) body.simbolo = simboloExtra;
  if (!Number.isNaN(planM) && planM > 0) body.planAporteMonto = planM;
  if (planF) {
    if (!Number.isNaN(planM) && planM > 0 && !planIni) {
      alert('Indicá la fecha de inicio de los aportes planificados (junto a la frecuencia).');
      return;
    }
    body.planAporteFrecuencia = planF;
  }
  if (planIni) body.planAporteInicio = planIni;

  if (!Number.isNaN(capital) && capital > 0) {
    if (!simboloExtra && !activoTieneMapaCotizacion(activo)) {
      alert(
        'Con capital inicial, si el activo no tiene cotización automática en el mapa, indicá el símbolo (ej. MSFT, BTC/USD).',
      );
      return;
    }
    body.capitalInvertido = capital;
  } else {
    if (Number.isNaN(cantidad) || cantidad <= 0 || Number.isNaN(precioCompra) || precioCompra <= 0) {
      alert('Completá capital inicial (> 0) o bien acciones y precio unitario (> 0).');
      return;
    }
    body.cantidad = cantidad;
    body.precioCompra = precioCompra;
  }

  try {
    await axios.post('/inversiones', body);
    e.target.reset();
    document.getElementById('valorMercado').textContent = 'Cotización: —';
    document.getElementById('resultadoInversion').textContent = '';
    document.querySelectorAll('#tipoInversionTabs .tab').forEach((t) => t.classList.remove('active'));
    selectedTipo = '';
    ultimaCotizacion = null;
    const wrap = document.getElementById('activoUnifiedWrap');
    if (wrap) wrap.style.display = 'none';
    document.getElementById('tipoInversionHint').textContent = 'Elegí un tipo de inversión arriba.';
    await cargarInversiones();
  } catch (err) {
    console.error('[inversiones] crear', err);
    const msg = err?.response?.data?.message || 'No se pudo guardar la inversión.';
    alert(Array.isArray(msg) ? msg.join('\n') : msg);
  }
}

function money(n) {
  return (Number(n) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'USD' });
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** ISO / Date para <input type="date"> (YYYY-MM-DD). */
function planInicioToInputValue(iso) {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function formatPlanInicioDisplay(iso) {
  const part = planInicioToInputValue(iso);
  if (!part) return '';
  const [y, mo, da] = part.split('-').map(Number);
  return new Date(y, mo - 1, da).toLocaleDateString('es-AR');
}

function plDiff(inv) {
  const cant = Number(inv.cantidad || 0);
  const pc = Number(inv.precioCompra || 0);
  const pa = inv.precioActual != null ? Number(inv.precioActual) : null;
  const invertido = cant * pc;
  const actualVal = cant * (pa != null && !Number.isNaN(pa) ? pa : pc);
  const diff = actualVal - invertido;
  const pct = invertido > 0 ? ((diff / invertido) * 100).toFixed(1) : null;
  return { diff, pct, invertido, actualVal };
}

function metricsForRow(inv) {
  const m = inv.metricas;
  if (m && typeof m.pnl === 'number') return m;
  const { diff, pct, invertido, actualVal } = plDiff(inv);
  return {
    simbolo: inv.simbolo || null,
    acciones: Number(inv.cantidad || 0),
    capitalInvertido: invertido,
    precioMercado: Number(inv.precioActual ?? inv.precioCompra ?? 0),
    valorActual: actualVal,
    pnl: diff,
    pnlPct: pct != null ? parseFloat(String(pct)) : null,
    variacionDiariaValor: 0,
    variacionDiariaPct: null,
    cotizacionAsOf: null,
    cotizacionFuente: 'local',
  };
}

async function cargarInversiones() {
  const el = document.getElementById('listaInversiones');
  el.innerHTML = '<p class="vacio">Cargando…</p>';

  try {
    const { data } = await axios.get('/inversiones');
    const rows = Array.isArray(data) ? data : [];
    el.innerHTML = '';
    if (!rows.length) {
      el.innerHTML = '<p class="vacio">No hay inversiones registradas.</p>';
      return;
    }

    rows.forEach((inv) => {
      const m = metricsForRow(inv);
      const diffCls = m.pnl >= 0 ? 'inversion-ganancia' : 'inversion-perdida';
      const sign = m.pnl >= 0 ? '+' : '';
      const pctStr = m.pnlPct != null && !Number.isNaN(m.pnlPct) ? `${sign}${m.pnlPct.toFixed(1)}%` : '—';
      const dSign = m.variacionDiariaValor >= 0 ? '+' : '';
      const dPct =
        m.variacionDiariaPct != null && !Number.isNaN(m.variacionDiariaPct)
          ? `${dSign}${m.variacionDiariaPct.toFixed(2)}%`
          : '—';
      const pair =
        typeof window.nbHistorialPair === 'function'
          ? window.nbHistorialPair('inversion', inv.id)
          : '';

      const div = document.createElement('div');
      div.className = 'nb-historial-item inversion-item';
      const tipoLbl = escapeHtml(TIPO_LABELS[inv.tipo] || inv.tipo);
      const planInicioTxt = inv.planAporteInicio ? formatPlanInicioDisplay(inv.planAporteInicio) : '';
      const planNote =
        Number(inv.planAporteMonto) > 0
          ? `<p class="nb-historial-meta">Plan (no ejecutado): ${money(inv.planAporteMonto)}${
              inv.planAporteFrecuencia ? ` · ${escapeHtml(inv.planAporteFrecuencia)}` : ''
            }${planInicioTxt ? ` · desde ${escapeHtml(planInicioTxt)}` : ''}</p>`
          : '';
      div.innerHTML = `
        <div class="nb-historial-body inversion-info">
          <p class="nb-historial-title">${escapeHtml(inv.activo)} <span style="font-weight:500;color:#64748b;font-size:0.9em;">(${tipoLbl})</span></p>
          <p class="nb-historial-meta">${escapeHtml(inv.categoria)} · ${m.acciones.toFixed(6)} u. · costo ${money(inv.precioCompra)} · mercado ${money(m.precioMercado)}</p>
          ${inv.descripcion ? `<p class="nb-historial-meta">${escapeHtml(inv.descripcion)}</p>` : ''}
          <p class="nb-historial-meta">Invertido: ${money(m.capitalInvertido)} · Valor: ${money(m.valorActual)}${inv.fondo?.nombre ? ` · ${escapeHtml(inv.fondo.nombre)}` : ''}</p>
          <p class="nb-historial-meta">Δ día: ${dSign}${money(m.variacionDiariaValor)} (${dPct})${m.simbolo ? ` · ${escapeHtml(m.simbolo)}` : ''} · ${escapeHtml(m.cotizacionFuente)}${m.cotizacionAsOf ? ` · ${escapeHtml(m.cotizacionAsOf)}` : ''}</p>
          ${planNote}
        </div>
        <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;">
          <span class="${diffCls}" style="font-weight:700;">PnL ${sign}${money(m.pnl)} (${pctStr})</span>
          ${pair}
        </div>
      `;
      el.appendChild(div);
    });
  } catch (err) {
    console.error('[inversiones] listar', err);
    el.innerHTML = '<p class="vacio">No se pudo cargar la lista.</p>';
  }
}

async function onListaInversionesClick(e) {
  const btn = e.target.closest('[data-entity="inversion"][data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  const { action } = btn.dataset;
  if (!id) return;

  if (action === 'delete') {
    if (!confirm('¿Eliminar esta inversión?')) return;
    try {
      await axios.delete(`/inversiones/${id}`);
      await cargarInversiones();
    } catch (err) {
      console.error('[inversiones] eliminar', err);
      alert('No se pudo eliminar.');
    }
    return;
  }

  if (action === 'edit') {
    try {
      const { data } = await axios.get(`/inversiones/${id}`);
      abrirModalEditarInversion(data);
    } catch (err) {
      console.error('[inversiones] obtener una', err);
      alert('No se pudo cargar la inversión.');
    }
  }
}

function abrirModalEditarInversion(inv) {
  document.getElementById('editInvId').value = inv.id;
  document.getElementById('editInvTipo').value = inv.tipo || 'otros';
  document.getElementById('editInvActivo').value = inv.activo || '';
  document.getElementById('editInvCategoria').value = inv.categoria || '';
  document.getElementById('editInvCantidad').value =
    inv.cantidad != null && !Number.isNaN(Number(inv.cantidad)) ? inv.cantidad : '';
  document.getElementById('editInvPrecioCompra').value =
    inv.precioCompra != null && !Number.isNaN(Number(inv.precioCompra)) ? inv.precioCompra : '';
  document.getElementById('editInvSimbolo').value = inv.simbolo || '';
  document.getElementById('editInvPrecioActual').value =
    inv.precioActual != null && !Number.isNaN(Number(inv.precioActual)) ? inv.precioActual : '';
  document.getElementById('editPlanMonto').value =
    inv.planAporteMonto != null && !Number.isNaN(Number(inv.planAporteMonto)) ? inv.planAporteMonto : '';
  document.getElementById('editPlanFrecuencia').value = inv.planAporteFrecuencia || '';
  document.getElementById('editPlanInicio').value = planInicioToInputValue(inv.planAporteInicio);
  document.getElementById('editInvDesc').value = inv.descripcion || '';

  const modal = document.getElementById('modalEditarInversion');
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
}

async function onSubmitEditarInversion(e) {
  e.preventDefault();
  const id = document.getElementById('editInvId').value;
  const payload = {
    tipo: document.getElementById('editInvTipo').value,
    activo: document.getElementById('editInvActivo').value.trim(),
    categoria: document.getElementById('editInvCategoria').value.trim(),
    cantidad: parseFloat(document.getElementById('editInvCantidad').value),
    precioCompra: parseFloat(document.getElementById('editInvPrecioCompra').value),
    simbolo: document.getElementById('editInvSimbolo').value.trim() || null,
    descripcion: document.getElementById('editInvDesc').value.trim() || null,
  };

  const planRaw = document.getElementById('editPlanMonto').value;
  const planIniEdit = (document.getElementById('editPlanInicio').value || '').trim();
  if (planRaw === '' || planRaw == null) {
    payload.planAporteMonto = null;
  } else {
    const pm = parseFloat(planRaw);
    payload.planAporteMonto = Number.isNaN(pm) ? null : pm;
  }
  payload.planAporteFrecuencia = document.getElementById('editPlanFrecuencia').value.trim() || null;
  payload.planAporteInicio = planIniEdit || null;

  const pmFinal = payload.planAporteMonto;
  const pfFinal = payload.planAporteFrecuencia;
  if (pmFinal != null && pmFinal > 0 && pfFinal && !planIniEdit) {
    alert('Indicá la fecha de inicio del plan (junto al monto y la frecuencia).');
    return;
  }

  const paRaw = document.getElementById('editInvPrecioActual').value;
  if (paRaw === '' || paRaw == null) {
    payload.precioActual = null;
  } else {
    const pa = parseFloat(paRaw);
    payload.precioActual = Number.isNaN(pa) ? null : pa;
  }

  if (!payload.activo || !payload.categoria) {
    alert('Activo y categoría son obligatorios.');
    return;
  }
  if (Number.isNaN(payload.cantidad) || payload.cantidad < 0) {
    alert('Cantidad no válida.');
    return;
  }
  if (Number.isNaN(payload.precioCompra) || payload.precioCompra < 0) {
    alert('Precio de compra no válido.');
    return;
  }

  try {
    await axios.patch(`/inversiones/${id}`, payload);
    document.getElementById('modalEditarInversion').style.display = 'none';
    document.getElementById('modalEditarInversion').setAttribute('aria-hidden', 'true');
    await cargarInversiones();
  } catch (err) {
    console.error('[inversiones] actualizar', err);
    const msg = err?.response?.data?.message || 'No se pudo actualizar.';
    alert(Array.isArray(msg) ? msg.join('\n') : msg);
  }
}
