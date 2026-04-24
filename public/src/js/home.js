
/** Alineado con backend `MOTIVO_APORTE_INICIAL` — no entra en proyección semanal de caja. */
const MOTIVO_APORTE_INICIAL = 'APORTE_INICIAL';
function esMovimientoAporteInicial(motivo) {
  return String(motivo ?? '').trim().toUpperCase() === MOTIVO_APORTE_INICIAL;
}

// ===== Base URL + token (por si auth.js no cargó antes) =====
(function ensureAxiosDefaults() {
  if (!axios.defaults.baseURL) axios.defaults.baseURL = '/api';
  const token = localStorage.getItem('token');
  if (token && !axios.defaults.headers.common['Authorization']) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
})();

// ===== Estado =====
const STATE = {
  period: 'SEMANA', // SEMANA | COMPARAR | 1M | 3M | 6M
  chart: null,
  data: {
    ingresos: [],
    gastos: [],
    inversiones: [],
    fondos: [],    // admite { id,nombre,meta,saldo,fijo|isFixed,frecuencia|frequency,fechaCreacion|startDate,aporteFijo|fixedAmount|montoFijo, movimientos|movements[] }
    deudas: [],    // admite { principal, startDate, firstDueDate?, installmentAmount?, frequency, payments|pagos[], saldoPend? }
  },
  settings: { weekStartDay: 1 }, // 1=Lunes por defecto (se sobrescribe)
  overrides: new Map(), // tipo:origId:YYYY-MM-DD -> { monto, label }
  skips: new Set(),     // tipo:origId:YYYY-MM-DD -> skip esta ocurrencia
};

// ===== Helpers de fecha =====
function startOfWeek(d, startDow = 1) { // startDow: 0=Dom..6=Sab
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = x.getDay(); // 0..6
  const delta = ((dow - startDow + 7) % 7);
  x.setDate(x.getDate() - delta);
  x.setHours(0,0,0,0);
  return x;
}
function endOfWeek(d, startDow = 1) {
  const s = startOfWeek(d, startDow);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  e.setHours(23,59,59,999);
  return e;
}
function addDays(d,n){ const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function addWeeks(d, n){ return addDays(d, n*7); }
function endOfMonth(y,m){ return new Date(y, m+1, 0).getDate(); }
function addMonthsSameDaySafe(d,n){
  const y=d.getFullYear(), m=d.getMonth(), day=d.getDate();
  const tm=m+n, ty=y+Math.floor(tm/12), tMon=((tm%12)+12)%12;
  const last=endOfMonth(ty,tMon);
  const r=new Date(d); r.setFullYear(ty,tMon,Math.max(1, Math.min(day,last))); r.setHours(0,0,0,0); return r;
}
function addMonths(d,n){ return addMonthsSameDaySafe(d,n); }
function fmtMoney(n){ return (Number(n)||0).toLocaleString('es-ES',{style:'currency',currency:'USD'}); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
function ymd(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function normalizeDateOnly(d){ const nd=new Date(d); nd.setHours(0,0,0,0); return nd; }

// ===== Carga =====
document.addEventListener('DOMContentLoaded', async () => {
  buildTopBars(); // crea banner + selector periodo + visor fondos/inv

  // Cargar settings (para semana personalizada)
  try {
    const resS = await axios.get('/settings');
    if (resS?.data) STATE.settings = resS.data;
  } catch (err) {
    console.warn('[home] no se pudo cargar settings, uso defaults', err);
  }

  try {
    const [resI, resG, resInv, resFondos, resDeudas] = await Promise.all([
      axios.get('/ingresos'),
      axios.get('/gastos'),
      axios.get('/inversiones'),
      axios.get('/ahorros', { params: { withMovs: 1 } }),
      axios.get('/deudas'),
    ]);

    STATE.data.ingresos    = Array.isArray(resI.data) ? resI.data : [];
    STATE.data.gastos      = Array.isArray(resG.data) ? resG.data : [];
    STATE.data.inversiones = Array.isArray(resInv.data) ? resInv.data : [];
    STATE.data.fondos      = Array.isArray(resFondos.data) ? resFondos.data : [];
    STATE.data.deudas      = Array.isArray(resDeudas.data) ? resDeudas.data : [];

    render();
  } catch (e) {
    console.error('[home] carga fallida', e);
    alert('No se pudieron cargar los datos.');
    window.location.replace('/src/login.html');
  }
});

// ===== Barra superior: banner + selector + visor compacto =====
function buildTopBars() {
  const main = document.querySelector('.dashboard-container') || document.body;

  // Banner de saldo proyectado
  let banner = document.getElementById('balanceBanner');
  if (!banner) {
    banner = document.createElement('section');
    banner.id = 'balanceBanner';
    banner.className = 'nb-balance-banner';
    banner.innerHTML = `
      <div class="nb-balance-banner-inner">
        <div class="nb-balance-banner-text">
          <div id="bbTitle" class="nb-balance-banner-title">—</div>
          <div id="bbMsg" class="nb-balance-banner-msg">Calculando proyección…</div>
        </div>
      </div>
    `;
    main.prepend(banner);
  }

  // Selector de periodo
  let bar = document.getElementById('periodBar');
  if (!bar) {
    bar = document.createElement('section');
    bar.id = 'periodBar';
    bar.className = 'nb-period-bar';
    main.insertBefore(bar, main.children[1]);
  }
  bar.innerHTML = `
    <label for="periodSelect" class="nb-period-bar-label">Periodo</label>
    <select id="periodSelect" class="nb-period-bar-select">
      <option value="SEMANA">Semana actual</option>
      <option value="COMPARAR">Comparar con semana anterior</option>
      <option value="1M">1 mes (semanas a futuro)</option>
      <option value="3M">3 meses (semanas a futuro)</option>
      <option value="6M">6 meses (semanas a futuro)</option>
    </select>
    <small class="nb-period-bar-hint">Usa el inicio de semana de Configuración.</small>
  `;
  bar.className = 'nb-period-bar';
  const sel = bar.querySelector('#periodSelect');
  sel.value = STATE.period;
  sel.onchange = () => { STATE.period = sel.value; render(); };

  // Visor compacto de fondos/inversiones (arriba del selector de periodo)
  let visor = document.getElementById('visorFondosInv');
  if (!visor) {
    visor = document.createElement('section');
    visor.id = 'visorFondosInv';
    visor.className = 'nb-visor-strip';
    main.insertBefore(visor, bar);
  }
  visor.innerHTML = `
    <div class="nb-visor-col">
      <h3 class="nb-visor-col-title">Ahorros</h3>
      <div id="visorFondos" class="nb-visor-cards"></div>
    </div>
    <div class="nb-visor-col">
      <h3 class="nb-visor-col-title">Inversiones</h3>
      <div id="visorInversiones" class="nb-visor-cards"></div>
    </div>
  `;
}

// ===== Replicación de ingresos/gastos fijos =====
function getFirstOccurrenceOnOrAfter(baseDate, start, frecuencia){
  let current = normalizeDateOnly(baseDate);
  const s = normalizeDateOnly(start);
  if (frecuencia === 'semanal') {
    while (current < s) current = addWeeks(current, 1);
  } else if (frecuencia === 'bisemanal') {
    while (current < s) current = addWeeks(current, 2);
  } else if (frecuencia === 'mensual') {
    while (current < s) current = addMonthsSameDaySafe(current, 1);
  }
  return current;
}

function replicateRecurringItems(items, start, end, tipo){
  const out = [];
  const s = normalizeDateOnly(start);
  const e = normalizeDateOnly(end);

  for (const it of items) {
    const raw = it.fecha || it.createdAt;
    if (!raw) continue;
    const base = normalizeDateOnly(raw);
    const fijo = !!it.fijo || !!it.isFixed;
    const freq = (it.frecuencia || it.frequency || '').toLowerCase(); // 'semanal' | 'bisemanal' | 'mensual'

    if (!fijo || (freq !== 'semanal' && freq !== 'bisemanal' && freq !== 'mensual')) {
      if (base >= s && base <= e) out.push(it);
      continue;
    }

    let occ = getFirstOccurrenceOnOrAfter(base, s, freq);
    while (occ <= e) {
      const dateKey = ymd(occ);
      const key = `${tipo}:${it.id}:${dateKey}`;
      if (!STATE.skips.has(key)) {
        const ov = STATE.overrides.get(key);
        out.push({
          ...it,
          id: `${it.id}__${dateKey}`,
          _originalId: it.id,
          _replicated: true,
          _dateKey: dateKey,
          fecha: new Date(occ).toISOString(),
          ...(ov ? { monto: ov.monto, _overrideLabel: ov.label } : {}),
        });
      }
      if (freq === 'semanal') occ = addWeeks(occ,1);
      else if (freq === 'bisemanal') occ = addWeeks(occ,2);
      else occ = addMonthsSameDaySafe(occ,1);
    }
  }
  return out;
}

// ===== Aportes de fondos por semana (reales + proyección) =====
function aporteItemsForWeek(fondos, start, end){
  const res=[];
  const s=normalizeDateOnly(start), e=normalizeDateOnly(end);

  fondos.forEach(f=>{
    // nombres tolerantes
    const movimientos = Array.isArray(f.movimientos) ? f.movimientos
                      : Array.isArray(f.movements) ? f.movements
                      : [];
    const fijo = !!(f.fijo ?? f.isFixed);
    const freq = (f.frecuencia || f.frequency || '').toLowerCase();
    const nombre = f.nombre || f.objetivo || 'Fondo';
    const fechaBase = f.fechaCreacion || f.startDate || new Date();
    const aporteFijo = Number(f.aporteFijo ?? f.fixedAmount ?? f.montoFijo ?? 0) || 0;

    // Reales (el aporte inicial es base del fondo, no sale del banco en la semana)
    movimientos.forEach(m=>{
      if (esMovimientoAporteInicial(m.motivo || m.reason)) return;
      const fecha = m.fecha || m.date;
      const monto = Number(m.monto ?? m.amount) || 0;
      if (!fecha) return;
      const nd=normalizeDateOnly(new Date(fecha));
      if(nd>=s && nd<=e){
        res.push({
          id: `mov_${f.id}_${m.id || ymd(nd)}`,
          fondoId: f.id,
          fecha: new Date(nd).toISOString(),
          monto,
          motivo: m.motivo || m.reason || 'APORTE',
          _type: 'aporte',
          _movId: m.id,
          _fondoNombre: nombre,
        });
      }
    });

    // Proyección si fijo
    if (!fijo || !['semanal','bisemanal','mensual'].includes(freq)) return;

    const movsFlujo = movimientos.filter((m) => !esMovimientoAporteInicial(m.motivo || m.reason));

    // monto base: último mov o aporteFijo
    let baseAmount = aporteFijo;
    if (!baseAmount && movsFlujo.length) {
      const movsSorted = [...movsFlujo].sort((a,b)=> new Date(a.fecha||a.date)-new Date(b.fecha||b.date));
      const last = movsSorted[movsSorted.length-1];
      baseAmount = Number(last?.monto ?? last?.amount) || 0;
    }
    if (!baseAmount) return;

    const existingDates = new Set(movimientos.map(m => ymd(new Date(m.fecha || m.date))));
    let occ = getFirstOccurrenceOnOrAfter(new Date(fechaBase), s, freq);
    while (occ <= e) {
      const dateKey = ymd(occ);
      if (!existingDates.has(dateKey)) {
        const key = `aportes:${f.id}:${dateKey}`;
        if (!STATE.skips.has(key)) {
          const ov = STATE.overrides.get(key);
          res.push({
            id: `movp_${f.id}_${dateKey}`,
            fondoId: f.id,
            fecha: occ.toISOString(),
            monto: ov?.monto ?? baseAmount,
            motivo: ov?.label || 'APORTE (proyectado)',
            _type: 'aporte',
            _replicated: true,
            _dateKey: dateKey,
            _fondoNombre: nombre,
          });
        }
      }
      if (freq==='semanal') occ = addWeeks(occ,1);
      else if (freq==='bisemanal') occ = addWeeks(occ,2);
      else occ = addMonthsSameDaySafe(occ,1);
    }
  });

  return res;
}

/** Capital puesto al abrir la posición (no precio unitario). */
function capitalInvertidoApertura(inv) {
  const m = inv.metricas;
  if (m && typeof m.capitalInvertido === 'number' && !Number.isNaN(m.capitalInvertido)) {
    return m.capitalInvertido;
  }
  const c = Number(inv.cantidad) || 0;
  const pc = Number(inv.precioCompra) || 0;
  return c * pc;
}

/**
 * Solo aportes planificados (planAporte*). El capital inicial no resta del banco en el resumen:
 * refleja plata que ya estaba en el fondo, no un gasto nuevo por semana.
 */
function inversionItemsForWeek(inversiones, start, end) {
  const res = [];
  const s = normalizeDateOnly(start);
  const e = normalizeDateOnly(end);

  for (const inv of inversiones) {
    const activo = inv.activo || inv.tipo || 'Inversión';
    const invId = inv.id;

    const planM = Number(inv.planAporteMonto);
    if (!planM || planM <= 0) continue;
    const freq = (inv.planAporteFrecuencia || '').toLowerCase();
    if (freq !== 'semanal' && freq !== 'mensual') continue;
    const baseInicio = inv.planAporteInicio || inv.createdAt;
    if (!baseInicio) continue;
    const inicio = normalizeDateOnly(new Date(baseInicio));

    if (freq === 'semanal') {
      let occ = getFirstOccurrenceOnOrAfter(inicio, s, 'semanal');
      while (occ <= e) {
        const nd = normalizeDateOnly(occ);
        if (nd >= inicio) {
          const dateKey = ymd(nd);
          const key = `inversiones:${invId}:${dateKey}`;
          if (!STATE.skips.has(key)) {
            const ov = STATE.overrides.get(key);
            res.push({
              id: `planinv_${invId}_${dateKey}`,
              inversionId: invId,
              fecha: nd.toISOString(),
              monto: ov?.monto ?? planM,
              activo,
              _replicated: true,
              _dateKey: dateKey,
              _originalId: invId,
              _type: 'plan',
            });
          }
        }
        occ = addWeeks(occ, 1);
      }
    } else {
      let occ = normalizeDateOnly(new Date(baseInicio));
      while (occ < s) occ = addMonthsSameDaySafe(occ, 1);
      while (occ <= e) {
        const nd = normalizeDateOnly(occ);
        if (nd >= inicio) {
          const dateKey = ymd(nd);
          const key = `inversiones:${invId}:${dateKey}`;
          if (!STATE.skips.has(key)) {
            const ov = STATE.overrides.get(key);
            res.push({
              id: `planinv_${invId}_${dateKey}`,
              inversionId: invId,
              fecha: nd.toISOString(),
              monto: ov?.monto ?? planM,
              activo,
              _replicated: true,
              _dateKey: dateKey,
              _originalId: invId,
              _type: 'plan',
            });
          }
        }
        occ = addMonthsSameDaySafe(occ, 1);
      }
    }
  }

  return res;
}

// ===== Proyección de deudas por rango =====
function deudaItemsForRange(deudas, start, end){
  const s=normalizeDateOnly(start), e=normalizeDateOnly(end);
  const out=[];

  for (const d of deudas) {
    const status = (d.status || '').toUpperCase();
    const activa = status ? status === 'ACTIVA' : (d.activa ?? d.active ?? true);
    if (!activa) continue;

    const payments = Array.isArray(d.pagos) ? d.pagos
                    : Array.isArray(d.payments) ? d.payments
                    : [];

    const frequency = (d.frequency || d.frecuencia || '').toLowerCase(); // semanal|bisemanal|mensual
    const firstDue = d.firstDueDate || d.primerVencimiento || d.startDate || d.fechaInicio || d.createdAt;
    const cuota = Number(d.installmentAmount ?? d.cuotaAmount ?? d.cuotaMonto ?? 0) || 0;

    // saldo pendiente: usar campo si existe; sino: principal - sum(pagos)
    const sumPagos = payments.reduce((a,p)=> a + (Number(p.monto ?? p.amount) || 0), 0);
    const saldoPend = Number(d.saldoPend ?? (Number(d.principal)||0) - sumPagos);

    // 1) pagos reales dentro del rango
    payments.forEach(p=>{
      const fecha = p.fecha || p.date;
      if (!fecha) return;
      const nd = normalizeDateOnly(new Date(fecha));
      if (nd>=s && nd<=e) {
        out.push({
          id: `dp_${d.id}_${p.id || ymd(nd)}`,
          deudaId: d.id,
          fecha: nd.toISOString(),
          monto: Number(p.monto ?? p.amount) || 0,
          _type: 'deuda',
          _replicated: false,
          _fTitle: d.title || d.nombre || 'Deuda',
        });
      }
    });

    // 2) proyección de cuotas solo si tenemos frecuencia + cuota + fecha inicial
    if (!['semanal','bisemanal','mensual'].includes(frequency) || !cuota || !firstDue || saldoPend <= 0) {
      continue;
    }

    const faltantesAprox = Math.min(240, Math.ceil(saldoPend / cuota)); // cap de seguridad
    let occ = normalizeDateOnly(new Date(firstDue));

    // avanzar desde el primer vencimiento para cubrir el rango pedido
    while (occ < s) {
      if (frequency==='semanal') occ = addWeeks(occ,1);
      else if (frequency==='bisemanal') occ = addWeeks(occ,2);
      else occ = addMonthsSameDaySafe(occ,1);
    }

    let generadas = 0;
    while (occ <= e && generadas < faltantesAprox) {
      const dateKey = ymd(occ);
      const key = `deudas:${d.id}:${dateKey}`;
      if (!STATE.skips.has(key)) {
        const ov = STATE.overrides.get(key);
        out.push({
          id: `dq_${d.id}_${dateKey}`,
          deudaId: d.id,
          fecha: occ.toISOString(),
          monto: ov?.monto ?? cuota,
          _type: 'deuda',
          _replicated: true,
          _dateKey: dateKey,
          _fTitle: d.title || d.nombre || 'Deuda',
        });
        generadas++;
      }
      if (frequency==='semanal') occ = addWeeks(occ,1);
      else if (frequency==='bisemanal') occ = addWeeks(occ,2);
      else occ = addMonthsSameDaySafe(occ,1);
    }
  }

  return out;
}

// ===== Render =====
function render() {
  const container = document.querySelector('.resumen-container');
  if (!container) return;
  container.innerHTML = '';

  // Visor balances arriba
  paintVisor();
  // Banner de saldo proyectado a 6M
  paintBalanceBanner();

  const weeks = buildWeeksFor(STATE.period);

  // Rango global del periodo seleccionado
  const rangeStart = weeks[0].start;
  const rangeEnd   = weeks[weeks.length - 1].end;

  // Replicar ingresos/gastos fijos en todo el rango
  const ingresosAll = replicateRecurringItems(STATE.data.ingresos, rangeStart, rangeEnd, 'ingresos');
  const gastosAll   = replicateRecurringItems(STATE.data.gastos,   rangeStart, rangeEnd, 'gastos');
  // Deudas (cuotas) en todo el rango
  const deudasAll   = deudaItemsForRange(STATE.data.deudas, rangeStart, rangeEnd);

  weeks.forEach(({start,end}, idx) => {
    const titulo = weekTitle(start, end, STATE.period, idx);

    const ingresos = itemsInRange(ingresosAll, start, end, 'fecha');
    const gastos   = itemsInRange(gastosAll,   start, end, 'fecha');
    const deudas   = itemsInRange(deudasAll,   start, end, 'fecha');
    const ahorrosAportes = aporteItemsForWeek(STATE.data.fondos, start, end);
    const inversionItems = inversionItemsForWeek(STATE.data.inversiones, start, end);

    const tot = {
      ingresos: sumBy(ingresos, vIngreso),
      gastos:   sumBy(gastos,   vGasto),
      deudas:   sumBy(deudas,   vDeuda),
      ahorros:  sumBy(ahorrosAportes, vAporte),
      inversiones: sumBy(inversionItems, vInversionFlujo),
    };
    const balance = tot.ingresos - tot.gastos - tot.deudas - tot.ahorros - tot.inversiones;

    const el = document.createElement('section');
    el.className = 'resumen-box';
    el.innerHTML = `
      <h2 class="resumen-title">${esc(titulo)}</h2>
      ${bloque('💰 Ingresos',           ingresos, 'ingresos',   vIngreso, lblIngreso)}
      ${bloque('📉 Gastos',             gastos,   'gastos',     vGasto,   lblGasto)}
      ${bloque('💳 Pagos de deudas',    deudas,   'deudas',     vDeuda,   lblDeuda)}
      ${bloque('💧 Aportes a fondos',   ahorrosAportes, 'aportes', vAporte, lblAporte)}
      ${bloque('📈 Inversiones',        inversionItems, 'inversiones', vInversionFlujo, lblInversionFlujo)}
      <div class="resumen-item resumen-final">
        <span>🧮 Balance:</span><strong>${fmtMoney(balance)}</strong>
      </div>
    `;
    container.appendChild(el);
  });

  // Totales para el gráfico
  const totals = weeks.reduce((acc,{start,end})=>{
    const ingresos = itemsInRange(ingresosAll, start, end, 'fecha');
    const gastos   = itemsInRange(gastosAll,   start, end, 'fecha');
    const deudas   = itemsInRange(deudasAll,   start, end, 'fecha');
    const ahorrosAportes = aporteItemsForWeek(STATE.data.fondos, start, end);
    const inversionItems = inversionItemsForWeek(STATE.data.inversiones, start, end);

    acc.ingresos += sumBy(ingresos, vIngreso);
    acc.gastos   += sumBy(gastos,   vGasto);
    acc.deudas   += sumBy(deudas,   vDeuda);
    acc.ahorros  += sumBy(ahorrosAportes, vAporte);
    acc.inv      += sumBy(inversionItems, vInversionFlujo);
    return acc;
  }, {ingresos:0,gastos:0,deudas:0,ahorros:0,inv:0});

  renderChart({ ingresos: totals.ingresos, gastos: totals.gastos, deudas: totals.deudas, ahorros: totals.ahorros, inversiones: totals.inv });
}

// ===== Banner de saldo proyectado a 6 meses =====
function paintBalanceBanner(){
  const bbTitle = document.getElementById('bbTitle');
  const bbMsg   = document.getElementById('bbMsg');
  if (!bbTitle || !bbMsg) return;

  // construir semanas 6M con tu inicio de semana
  const startDow = Number(STATE.settings?.weekStartDay ?? 1);
  const today=new Date(); const curS=startOfWeek(today, startDow);
  const endTarget=endOfWeek(addMonths(today,6), startDow);
  const weeks=[]; let c=new Date(curS);
  while(c<=endTarget){ weeks.push({start:new Date(c),end:endOfWeek(c,startDow)}); c=addWeeks(c,1); }

  const rangeStart = weeks[0].start;
  const rangeEnd   = weeks[weeks.length-1].end;

  // replicas para todo el rango
  const ingresosAll = replicateRecurringItems(STATE.data.ingresos, rangeStart, rangeEnd, 'ingresos');
  const gastosAll   = replicateRecurringItems(STATE.data.gastos,   rangeStart, rangeEnd, 'gastos');
  const deudasAll   = deudaItemsForRange(STATE.data.deudas, rangeStart, rangeEnd);

  let anyNegative = null;
  let balanceAcum = 0;
  weeks.forEach(({start,end})=>{
    const ingresos = itemsInRange(ingresosAll, start, end, 'fecha');
    const gastos   = itemsInRange(gastosAll,   start, end, 'fecha');
    const deudas   = itemsInRange(deudasAll,   start, end, 'fecha');
    const ahorrosAportes = aporteItemsForWeek(STATE.data.fondos, start, end);
    const invItems = inversionItemsForWeek(STATE.data.inversiones, start, end);

    const tot = sumBy(ingresos, vIngreso)
              - sumBy(gastos, vGasto)
              - sumBy(deudas, vDeuda)
              - sumBy(ahorrosAportes, vAporte)
              - sumBy(invItems, vInversionFlujo);
    balanceAcum += tot;
    if (anyNegative === null && tot < 0) anyNegative = {start, end, tot};
  });

  const banner = document.getElementById('balanceBanner');
  const isPos = balanceAcum >= 0;
  if (banner) {
    banner.classList.toggle('is-positive', isPos);
    banner.classList.toggle('is-negative', !isPos);
  }
  bbTitle.textContent = `Saldo proyectado (6 meses): ${fmtMoney(balanceAcum)}`;
  bbTitle.style.color = '';
  bbMsg.textContent = anyNegative
    ? `Alerta: la semana del ${anyNegative.start.toLocaleDateString()} al ${anyNegative.end.toLocaleDateString()} proyecta balance negativo.`
    : 'No se detectan semanas negativas en los próximos 6 meses.';
}

// ===== Visor (fondos) =====
function paintVisor() {
  const fEl = document.getElementById('visorFondos');
  const iEl = document.getElementById('visorInversiones');
  if (fEl) {
    const visorCards = STATE.data.fondos.map((f) => {
      const saldoApi = Number(f.saldo) || 0;
      const baseIni = f.saldoBaseInicial != null ? Number(f.saldoBaseInicial) || 0 : 0;
      const otros =
        f.saldoOtrosAportes != null ? Number(f.saldoOtrosAportes) || 0 : Math.max(0, saldoApi - baseIni);
      const aportado = saldoApi || baseIni + otros;
      const conRend =
        f.saldoConRendimiento != null && !Number.isNaN(Number(f.saldoConRendimiento))
          ? Number(f.saldoConRendimiento)
          : aportado;
      const tieneTasa = f.tasaAnualPct != null && Number.isFinite(Number(f.tasaAnualPct));
      const pills = [];
      if (baseIni > 0) {
        pills.push(`<span class="nb-visor-pill nb-visor-pill--base" title="Aporte inicial (base del fondo)">Base ${fmtMoney(baseIni)}</span>`);
      }
      if (otros > 0) {
        pills.push(`<span class="nb-visor-pill nb-visor-pill--flow" title="Aportes que impactan el flujo">+ Aportes ${fmtMoney(otros)}</span>`);
      }
      const pillsHtml = pills.length ? `<div class="nb-visor-fondo-pills">${pills.join('')}</div>` : '';
      const tasaHtml = tieneTasa
        ? `<div class="nb-visor-fondo-tasa">${Number(f.tasaAnualPct).toFixed(2)}% a.a. · nominal ${fmtMoney(aportado)}</div>`
        : '';
      const saldoLbl = tieneTasa ? 'Total estimado' : 'Total fondo';
      return `<div class="nb-visor-fondo-card" tabindex="0" role="group">
        <div class="nb-visor-fondo-head">
          <span class="nb-visor-fondo-name">${esc(f.nombre || f.objetivo || 'Fondo')}</span>
          <span class="nb-visor-fondo-meta">Meta ${fmtMoney(Number(f.meta) || 0)}</span>
        </div>
        <div class="nb-visor-fondo-total">${fmtMoney(conRend)}</div>
        <div class="nb-visor-fondo-sublbl">${esc(saldoLbl)}</div>
        ${pillsHtml}
        ${tasaHtml}
      </div>`;
    }).join('') || '<p class="nb-visor-empty">Sin fondos</p>';
    fEl.innerHTML = visorCards;
  }
  if (iEl) {
    const invs = STATE.data.inversiones;
    if (!invs.length) {
      iEl.innerHTML = '<p class="nb-visor-empty">Sin inversiones</p>';
    } else {
      let totalInv = 0;
      let totalVal = 0;
      invs.forEach((inv) => {
        const m = inv.metricas;
        const cap =
          m && typeof m.capitalInvertido === 'number'
            ? m.capitalInvertido
            : capitalInvertidoApertura(inv);
        const val = m && typeof m.valorActual === 'number' ? m.valorActual : cap;
        totalInv += cap;
        totalVal += val;
      });
      const pnl = totalVal - totalInv;
      const pnlPct = totalInv > 0 ? (pnl / totalInv) * 100 : null;
      const sign = pnl >= 0 ? '+' : '';
      const pctStr = pnlPct != null && !Number.isNaN(pnlPct) ? `${sign}${pnlPct.toFixed(1)}%` : '—';
      const invCls = pnl >= 0 ? 'is-up' : 'is-down';
      iEl.innerHTML = `
        <div class="nb-visor-inv-card ${invCls}" tabindex="0" role="group">
          <div class="nb-visor-inv-label">Cartera agregada</div>
          <div class="nb-visor-inv-row"><span>Invertido</span><strong>${fmtMoney(totalInv)}</strong></div>
          <div class="nb-visor-inv-row"><span>Valor mercado</span><strong>${fmtMoney(totalVal)}</strong></div>
          <div class="nb-visor-inv-pnl">PnL ${sign}${fmtMoney(pnl)} <span class="nb-visor-inv-pct">(${pctStr})</span></div>
        </div>`;
    }
  }
}

// ===== Semanas por periodo (respeta settings.weekStartDay) =====
function buildWeeksFor(period){
  const startDow = Number(STATE.settings?.weekStartDay ?? 1);
  const today=new Date(); const curS=startOfWeek(today, startDow); const curE=endOfWeek(today, startDow);
  if(period==='SEMANA') return [{start:curS,end:curE}];
  if(period==='COMPARAR'){ const prevS=addWeeks(curS,-1); return [{start:curS,end:curE},{start:prevS,end:endOfWeek(prevS,startDow)}]; }
  const monthsMap={ '1M':1,'3M':3,'6M':6 }; const m=monthsMap[period]||1;
  const endTarget=endOfWeek(addMonths(today,m), startDow);
  const arr=[]; let c=new Date(curS);
  while(c<=endTarget){ arr.push({start:new Date(c),end:endOfWeek(c,startDow)}); c=addWeeks(c,1); }
  return arr;
}
function weekTitle(start,end,period,idx){
  const r=`Semana del ${start.toLocaleDateString()} al ${end.toLocaleDateString()}`;
  if(period==='COMPARAR' && idx===1) return `${r} (anterior)`; if(idx===0) return `${r} (actual)`; return r;
}

// ===== Filtros / sumas =====
function itemsInRange(list,start,end,campo){
  return list.filter(it=>{
    const raw = it[campo] || it['fecha'] || it['createdAt'];
    if(!raw) return false;
    const d=new Date(raw);
    return d>=start && d<=end;
  });
}
function sumBy(arr, valFn){ return arr.reduce((a,x)=>a+(Number(valFn(x))||0),0); }

// ===== Mapeos por tipo =====
function vIngreso(it){
  if (it._replicated && it._dateKey) {
    const k = `ingresos:${it._originalId}:${it._dateKey}`;
    const ov = STATE.overrides.get(k);
    if (ov && typeof ov.monto === 'number') return ov.monto;
  }
  return it.monto;
}
function vGasto(it){
  if (it._replicated && it._dateKey) {
    const k = `gastos:${it._originalId}:${it._dateKey}`;
    const ov = STATE.overrides.get(k);
    if (ov && typeof ov.monto === 'number') return ov.monto;
  }
  return it.monto;
}
function vDeuda(it){
  if (it._replicated && it._dateKey) {
    const k = `deudas:${it.deudaId}:${it._dateKey}`;
    const ov = STATE.overrides.get(k);
    if (ov && typeof ov.monto === 'number') return ov.monto;
  }
  return it.monto;
}
/** Ítems sintéticos de inversionItemsForWeek (monto = flujo de caja). */
function vInversionFlujo(it) {
  if (it._replicated && it._dateKey) {
    const k = `inversiones:${it._originalId}:${it._dateKey}`;
    const ov = STATE.overrides.get(k);
    if (ov && typeof ov.monto === 'number') return ov.monto;
  }
  return Number(it.monto) || 0;
}
function vAporte(it){
  if (it._replicated && it._dateKey) {
    const k = `aportes:${it.fondoId}:${it._dateKey}`;
    const ov = STATE.overrides.get(k);
    if (ov && typeof ov.monto === 'number') return ov.monto;
  }
  return it.monto;
}

// ===== Labels =====
function lblIngreso(it){
  if (it._replicated && it._overrideLabel) return it._overrideLabel;
  if (it._replicated && it._dateKey) {
    const ov = STATE.overrides.get(`ingresos:${it._originalId}:${it._dateKey}`);
    if (ov?.label) return ov.label;
  }
  return it.fuente || it.categoria || 'Ingreso';
}
function lblGasto(it){
  if (it._replicated && it._overrideLabel) return it._overrideLabel;
  if (it._replicated && it._dateKey) {
    const ov = STATE.overrides.get(`gastos:${it._originalId}:${it._dateKey}`);
    if (ov?.label) return ov.label;
  }
  return it.descripcion || (typeof it.categoria==='object'? (it.categoria?.nombre||'Gasto') : (it.categoria||'Gasto'));
}
function lblDeuda(it){
  if (it._replicated && it._dateKey) {
    const ov = STATE.overrides.get(`deudas:${it.deudaId}:${it._dateKey}`);
    if (ov?.label) return `Deuda (${ov.label})`;
  }
  return `Deuda: ${it._fTitle || 'Pago'}`;
}
function lblAporte(it){
  if (it._replicated && it._dateKey) {
    const ov = STATE.overrides.get(`aportes:${it.fondoId}:${it._dateKey}`);
    if (ov?.label) return `Fondo ${it._fondoNombre} (${ov.label})`;
  }
  return `Fondo ${it._fondoNombre} (${it.motivo||'APORTE'})`;
}
function lblInversionFlujo(it) {
  if (it._replicated && it._dateKey) {
    const ov = STATE.overrides.get(`inversiones:${it._originalId}:${it._dateKey}`);
    if (ov?.label) return `${it.activo} (${ov.label})`;
  }
  if (it._type === 'plan') return `Plan aporte — ${it.activo}`;
  return it.activo || 'Inversión';
}

// ===== Bloque HTML reutilizable =====
function bloque(titulo, lista, tipo, valFn, labelFn){
  const contenido = lista.length
    ? `<div class="detalle-items">
        ${lista.map(item => {
          const isRep = !!item._replicated;
          const dateKey = item._dateKey || (item.fecha ? ymd(new Date(item.fecha)) : '');
          const origId = item._originalId ?? item.deudaId ?? item.inversionId ?? item.id;
          return `
          <div class="item-detalle">
            <span>${esc(labelFn(item))}: ${fmtMoney(valFn(item))}</span>
            <div>
              ${acciones(tipo, item.id, origId, isRep, dateKey, item)}
            </div>
          </div>`;
        }).join('')}
      </div>`
    : `<div class="detalle-items"><em>No hay registros.</em></div>`;

  return `
    <div class="resumen-item"><span>${titulo}</span><strong>${fmtMoney(sumBy(lista,valFn))}</strong></div>
    ${contenido}
  `;
}

// Acciones (edit/eliminar)
function acciones(tipo, id, originalId, isRep, dateKey, item){
  if (tipo === 'aportes') {
    if (isRep) {
      return `
        <button class="btn-edit-occ" data-tipo="${tipo}" data-orig="${originalId}" data-date="${dateKey}">✏️</button>
        <button class="btn-del-occ"  data-tipo="${tipo}" data-orig="${originalId}" data-date="${dateKey}">❌</button>
      `;
    }
    const [fondoId, movId] = parseAporteRealIds(id);
    return `
      <button class="btn-edit-aporte" data-fondo="${fondoId}" data-mov="${movId}">✏️</button>
      <button class="btn-del-aporte"  data-fondo="${fondoId}" data-mov="${movId}">❌</button>
    `;
  }

  if (tipo === 'deudas') {
    if (isRep) {
      return `
        <button class="btn-edit-occ" data-tipo="deudas" data-orig="${originalId}" data-date="${dateKey}">✏️</button>
        <button class="btn-del-occ"  data-tipo="deudas" data-orig="${originalId}" data-date="${dateKey}">❌</button>
      `;
    }
    return `<span class="muted">Pago real</span>`;
  }

  if (tipo === 'inversiones') {
    if (isRep && dateKey) {
      return `
        <button class="btn-edit-occ" data-tipo="inversiones" data-orig="${originalId}" data-date="${dateKey}">✏️</button>
        <button class="btn-del-occ"  data-tipo="inversiones" data-orig="${originalId}" data-date="${dateKey}">❌</button>
      `;
    }
    return '<span class="muted">—</span>';
  }

  if (isRep) {
    return `
      <button class="btn-edit-occ" data-tipo="${tipo}" data-orig="${originalId}" data-date="${dateKey}">✏️</button>
      <button class="btn-del-occ"  data-tipo="${tipo}" data-orig="${originalId}" data-date="${dateKey}">❌</button>
    `;
  }

  return `
    <button class="btn-editar-item" data-id="${id}" data-tipo="${tipo}">✏️</button>
    <button class="btn-eliminar-item" data-id="${id}" data-tipo="${tipo}">❌</button>
  `;
}

function parseAporteRealIds(idStr){
  const parts = String(idStr).split('_'); // "mov_{fondoId}_{movId}"
  return [Number(parts[1]), Number(parts[2])];
}

/** Alineado con :root --mod-* en dashboard-shell.css */
function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function chartModuleBackgroundColors() {
  return [
    cssVar('--mod-ingresos', '#059669'),
    cssVar('--mod-gastos', '#dc2626'),
    cssVar('--mod-deudas', '#ea580c'),
    cssVar('--mod-ahorros', '#2563eb'),
    cssVar('--mod-inversiones', '#7c3aed'),
  ];
}

/** Relleno suave para la dona (alineado con UI tipo fintech). */
function hexToRgba(color, alpha) {
  const s = String(color).trim();
  if (/^rgba?\(/i.test(s)) return s;
  const hex = s.startsWith('#') ? s.slice(1) : s;
  if (hex.length !== 6) return s;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function chartModuleFillColors(alpha = 0.9) {
  return chartModuleBackgroundColors().map((c) => hexToRgba(c, alpha));
}

/** Texto centrado en el agujero: volumen total del gráfico + estado vacío. */
const nbDonutCenterPlugin = {
  id: 'nbDonutCenter',
  afterDraw(chart) {
    const ds = chart.data.datasets[0];
    if (!ds?.data?.length) return;
    const values = ds.data.map((v) => Number(v) || 0);
    const sum = values.reduce((a, b) => a + b, 0);
    const meta = chart.getDatasetMeta(0);
    const arc0 = meta.data[0];
    if (!arc0) return;
    const { x, y, innerRadius } = arc0;
    const ctx = chart.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (sum <= 0) {
      ctx.font = '600 12px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Sin movimientos', x, y - 7);
      ctx.font = '500 11px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('en este período', x, y + 9);
      ctx.restore();
      return;
    }
    const labelSize = Math.max(9, Math.round(innerRadius * 0.14));
    const valueSize = Math.max(14, Math.min(20, Math.round(innerRadius * 0.36)));
    ctx.font = `600 ${labelSize}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = '#64748b';
    ctx.fillText('Suma categorías', x, y - innerRadius * 0.15);
    ctx.font = `800 ${valueSize}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = '#0f172a';
    ctx.letterSpacing = '-0.02em';
    ctx.fillText(fmtMoney(sum), x, y + innerRadius * 0.12);
    ctx.restore();
  },
};

// ===== Gráfico =====
function renderChart(tot) {
  const el = document.getElementById('graficoResumen');
  if (!el) return;
  const ctx = el.getContext('2d');
  if (STATE.chart) STATE.chart.destroy();
  const fills = chartModuleFillColors(0.88);
  const fillsHover = chartModuleFillColors(0.98);
  STATE.chart = new Chart(ctx, {
    type: 'doughnut',
    plugins: [nbDonutCenterPlugin],
    data: {
      labels: ['Ingresos', 'Gastos', 'Deudas', 'Ahorros (aportes)', 'Inversiones'],
      datasets: [{
        data: [tot.ingresos, tot.gastos, tot.deudas, tot.ahorros, tot.inversiones],
        backgroundColor: fills,
        hoverBackgroundColor: fillsHover,
        borderColor: '#ffffff',
        borderWidth: 3,
        hoverBorderWidth: 3,
        borderRadius: 10,
        spacing: 2,
        hoverOffset: 10,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '64%',
      layout: { padding: { top: 8, bottom: 10, left: 6, right: 6 } },
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 780,
        easing: 'easeOutCubic',
      },
      interaction: { mode: 'nearest', intersect: true },
      hover: { mode: 'nearest', intersect: true },
      plugins: {
        legend: {
          position: 'bottom',
          align: 'center',
          labels: {
            color: '#475569',
            font: { family: 'Inter, system-ui, sans-serif', size: 11, weight: '600' },
            padding: 10,
            boxWidth: 8,
            boxHeight: 8,
            usePointStyle: true,
            pointStyle: 'circle',
            generateLabels(chart) {
              const data = chart.data;
              const ds = data.datasets[0];
              const sum = (ds.data || []).reduce((a, b) => a + Number(b || 0), 0);
              return data.labels.map((label, i) => {
                const v = Number(ds.data[i]) || 0;
                const pct = sum > 0 ? Math.round((v / sum) * 100) : 0;
                const hidden = typeof chart.getDataVisibility === 'function'
                  ? !chart.getDataVisibility(i)
                  : false;
                const fill = Array.isArray(ds.backgroundColor) ? ds.backgroundColor[i] : ds.backgroundColor;
                const bw = typeof ds.borderWidth === 'number' ? ds.borderWidth : 2;
                return {
                  text: `${label}  ${pct}%`,
                  fillStyle: fill,
                  strokeStyle: fill,
                  lineWidth: 0,
                  hidden,
                  index: i,
                  datasetIndex: 0,
                };
              });
            },
          },
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.94)',
          titleColor: '#f1f5f9',
          bodyColor: '#e2e8f0',
          borderColor: 'rgba(148, 163, 184, 0.25)',
          borderWidth: 1,
          displayColors: true,
          boxPadding: 6,
          bodyFont: { family: 'Inter, system-ui, sans-serif', size: 13, weight: '600' },
          titleFont: { family: 'Inter, system-ui, sans-serif', size: 11, weight: '700' },
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            title: (items) => (items[0] ? items[0].label : ''),
            label: (c) => {
              const raw = Number(c.raw) || 0;
              const ds = c.chart.data.datasets[0];
              const sum = (ds.data || []).reduce((a, b) => a + Number(b || 0), 0);
              const pct = sum > 0 ? Math.round((raw / sum) * 100) : 0;
              return ` ${fmtMoney(raw)}  ·  ${pct}%`;
            },
          },
        },
      },
    },
  });
}

// ===== Handlers globales =====
document.body.addEventListener('click', async (e) => {
  if (e.target.classList.contains('btn-eliminar-item')) {
    const tipo = e.target.dataset.tipo; // ingresos | gastos | inversiones
    const id = e.target.dataset.id;
    if (confirm('¿Eliminar este registro?')) {
      try { await axios.delete(`/${tipo}/${id}`); location.reload(); }
      catch { alert('Error al eliminar.'); }
    }
  }

  if (e.target.classList.contains('btn-editar-item')) {
    const id = e.target.dataset.id;
    const tipo = e.target.dataset.tipo;
    const span = e.target.closest('.item-detalle')?.querySelector('span');
    const txt = span ? span.innerText : '';
    const m = txt.match(/\$([\d.,]+)/);
    const desc = txt.split(':')[0].trim();

    document.getElementById('editId').value = id;
    document.getElementById('editTipo').value = tipo;
    document.getElementById('editFuente').value = desc;
    document.getElementById('editMonto').value = m ? Number(m[1].replace(/\./g,'').replace(',','.')) : '';
    document.getElementById('editFecha').value = new Date().toISOString().split('T')[0];

    document.getElementById('modalEditar').style.display = 'flex';
  }

  // Ocurrencia UI
  if (e.target.classList.contains('btn-del-occ')) {
    const tipo = e.target.dataset.tipo;   // ingresos | gastos | aportes | deudas
    const orig = e.target.dataset.orig;
    const date = e.target.dataset.date;   // YYYY-MM-DD
    if (!confirm('¿Ocultar solo esta ocurrencia en esta semana?')) return;
    STATE.skips.add(`${tipo}:${orig}:${date}`);
    render();
  }
  if (e.target.classList.contains('btn-edit-occ')) {
    const tipo = e.target.dataset.tipo;
    const orig = e.target.dataset.orig;
    const date = e.target.dataset.date;
    const montoStr = prompt('Nuevo monto para esta semana:'); if (montoStr === null) return;
    const monto = Number(montoStr); if (Number.isNaN(monto)) return alert('Monto inválido');
    const label = prompt('Etiqueta/Descripción (opcional):') || '';
    STATE.overrides.set(`${tipo}:${orig}:${date}`, { monto, label });
    render();
  }

  // Aportes reales
  if (e.target.classList.contains('btn-del-aporte')) {
    const fondoId = e.target.dataset.fondo;
    const movId = e.target.dataset.mov;
    if (confirm('¿Eliminar este aporte del fondo?')) {
      try { await axios.delete(`/ahorros/${fondoId}/movimientos/${movId}`); location.reload(); }
      catch { alert('No se pudo eliminar el aporte.'); }
    }
  }
  if (e.target.classList.contains('btn-edit-aporte')) {
    const fondoId = e.target.dataset.fondo;
    const movId = e.target.dataset.mov;
    const nuevoMontoStr = prompt('Nuevo monto del aporte:');
    if (!nuevoMontoStr) return;
    const nuevoMonto = Number(nuevoMontoStr);
    if (isNaN(nuevoMonto)) return alert('Monto inválido');
    try { await axios.patch(`/ahorros/${fondoId}/movimientos/${movId}`, { monto: nuevoMonto }); location.reload(); }
    catch { alert('No se pudo actualizar el aporte.'); }
  }
});

// Guardar edición real desde modal
document.getElementById('formEditar')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('editId').value;
  const tipo = document.getElementById('editTipo').value;
  const fuente = document.getElementById('editFuente').value;
  const monto = Number(document.getElementById('editMonto').value);
  const fecha = document.getElementById('editFecha').value;

  try {
    await axios.patch(`/${tipo}/${id}`, {
      monto,
      fecha,
      ...(tipo === 'ingresos' ? { fuente } : { descripcion: fuente }),
    });
    document.getElementById('modalEditar').style.display = 'none';
    location.reload();
  } catch {
    alert('Error al guardar cambios.');
  }
});

document.getElementById('btnCancelar')?.addEventListener('click', () => {
  document.getElementById('modalEditar').style.display = 'none';
});

