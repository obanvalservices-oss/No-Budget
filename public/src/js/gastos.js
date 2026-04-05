// Gastos — categorías con UUID (GASTOS)

const MODULO = 'GASTOS';

document.addEventListener('DOMContentLoaded', async () => {
  await cargarCategoriasDesdeBackend();
  await cargarGastos();

  document.getElementById('historialGastos').addEventListener('click', onHistorialGastosClick);

  document.getElementById('gastosForm').addEventListener('submit', onSubmitNuevoGasto);

  document.getElementById('categoriaGasto').addEventListener('change', (e) => {
    const inputNueva = document.getElementById('nuevaCategoriaInput');
    if (e.target.value === 'crear-nueva') {
      inputNueva.classList.add('is-visible');
      inputNueva.focus();
    } else {
      inputNueva.classList.remove('is-visible');
      inputNueva.value = '';
    }
  });

  const modal = document.getElementById('modalEditarGasto');
  document.getElementById('btnCancelarEditGasto').addEventListener('click', () => {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
  });
  document.getElementById('formEditarGasto').addEventListener('submit', onSubmitEditarGasto);
});

async function onSubmitNuevoGasto(e) {
  e.preventDefault();

  const descripcion = document.getElementById('descripcionGasto').value.trim();
  const monto = parseFloat(document.getElementById('montoGasto').value);
  const frecuencia = document.getElementById('frecuenciaGasto').value || 'una_vez';
  const fecha = document.getElementById('fechaPagoGasto').value;
  const origen = document.getElementById('origenGasto').value.trim() || 'General';
  const fijo = document.getElementById('fijoGasto').checked;

  const categoriaSelect = document.getElementById('categoriaGasto');
  let categoriaId = categoriaSelect.value;

  if (categoriaId === 'crear-nueva') {
    const nuevaCategoriaInput = document.getElementById('nuevaCategoriaInput');
    const nuevaCategoria = (nuevaCategoriaInput.value || '').trim();

    if (!nuevaCategoria) {
      alert('Debes escribir un nombre para la nueva categoría');
      return;
    }

    try {
      const res = await axios.post('/categorias', {
        nombre: nuevaCategoria,
        modulo: MODULO,
      });
      categoriaId = res.data.id;
      await cargarCategoriasDesdeBackend();
      document.getElementById('categoriaGasto').value = categoriaId;
      nuevaCategoriaInput.classList.remove('is-visible');
      nuevaCategoriaInput.value = '';
    } catch (err) {
      console.error('Error creando categoría:', err);
      const msg = err?.response?.data?.message || 'No se pudo crear la categoría';
      alert(Array.isArray(msg) ? msg.join('\n') : msg);
      return;
    }
  }

  const nuevoGasto = {
    descripcion,
    monto,
    frecuencia,
    fecha,
    origen,
    fijo,
    categoriaId,
  };

  try {
    await axios.post('/gastos', nuevoGasto);
    e.target.reset();
    document.getElementById('nuevaCategoriaInput').classList.remove('is-visible');
    await cargarGastos();
  } catch (err) {
    console.error('Error guardando gasto:', err);
    const msg = err?.response?.data?.message || 'No se pudo guardar el gasto';
    alert(Array.isArray(msg) ? msg.join('\n') : msg);
  }
}

async function cargarCategoriasDesdeBackend() {
  try {
    const select = document.getElementById('categoriaGasto');
    select.innerHTML = '<option value="">Selecciona una categoría</option>';

    const res = await axios.get('/categorias', {
      params: { modulo: MODULO },
    });

    (res.data || []).forEach((cat) => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = cat.nombre;
      select.appendChild(option);
    });

    const nueva = document.createElement('option');
    nueva.value = 'crear-nueva';
    nueva.textContent = '➕ Crear nueva categoría';
    select.appendChild(nueva);
  } catch (err) {
    console.error('Error cargando categorías:', err);
  }
}

function syncEditGastoCategorias() {
  const main = document.getElementById('categoriaGasto');
  const modalSel = document.getElementById('editCatGasto');
  modalSel.innerHTML = '';
  [...main.options].forEach((opt) => {
    if (!opt.value || opt.value === 'crear-nueva') return;
    modalSel.appendChild(opt.cloneNode(true));
  });
}

async function cargarGastos() {
  try {
    const res = await axios.get('/gastos');
    renderGastos(res.data || []);
  } catch (err) {
    console.error('Error al cargar gastos:', err);
  }
}

function formatGastoFecha(fechaVal) {
  if (!fechaVal) return '—';
  const d = new Date(fechaVal);
  return Number.isNaN(+d) ? String(fechaVal) : d.toLocaleDateString();
}

function renderGastos(gastos) {
  const contenedor = document.getElementById('historialGastos');
  contenedor.innerHTML = '';

  if (!gastos.length) {
    contenedor.innerHTML = `<p class="vacio">No hay gastos registrados.</p>`;
    return;
  }

  gastos.forEach((gasto) => {
    const nombreCat = gasto.categoria?.nombre || 'Sin categoría';
    const freq = gasto.frecuencia || 'una_vez';
    const org = gasto.origen || 'General';
    const li = document.createElement('div');
    li.className = 'nb-historial-item';
    li.innerHTML = `
      <div class="nb-historial-body info">
        <p class="nb-historial-title">${escapeHtml(gasto.descripcion)}</p>
        <p class="nb-historial-meta">${escapeHtml(nombreCat)} · ${escapeHtml(freq)} · ${escapeHtml(org)}</p>
        <p class="nb-historial-meta">Fecha: ${escapeHtml(formatGastoFecha(gasto.fecha))}</p>
      </div>
      <div style="display:flex;align-items:center;gap:0.75rem;">
        <span class="nb-historial-amount monto negativo">-$${Number(gasto.monto || 0).toFixed(2)}</span>
        ${window.nbHistorialPair('gasto', gasto.id)}
      </div>
    `;
    contenedor.appendChild(li);
  });
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function abrirModalEditarGasto(gasto) {
  syncEditGastoCategorias();
  document.getElementById('editGastoId').value = gasto.id;
  document.getElementById('editDescGasto').value = gasto.descripcion || '';
  document.getElementById('editMontoGasto').value = gasto.monto ?? '';
  document.getElementById('editCatGasto').value = gasto.categoriaId || '';
  document.getElementById('editFrecGasto').value = gasto.frecuencia || 'una_vez';
  const fd = gasto.fecha ? new Date(gasto.fecha) : null;
  document.getElementById('editFechaGasto').value =
    fd && !Number.isNaN(+fd) ? fd.toISOString().slice(0, 10) : '';
  document.getElementById('editOrigenGasto').value = gasto.origen || 'Banco';
  document.getElementById('editFijoGasto').checked = !!gasto.fijo;

  const modal = document.getElementById('modalEditarGasto');
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
}

async function onSubmitEditarGasto(e) {
  e.preventDefault();
  const id = document.getElementById('editGastoId').value;
  const payload = {
    descripcion: document.getElementById('editDescGasto').value.trim(),
    monto: parseFloat(document.getElementById('editMontoGasto').value),
    categoriaId: document.getElementById('editCatGasto').value,
    frecuencia: document.getElementById('editFrecGasto').value,
    fecha: document.getElementById('editFechaGasto').value,
    origen: document.getElementById('editOrigenGasto').value,
    fijo: document.getElementById('editFijoGasto').checked,
  };

  try {
    await axios.patch(`/gastos/${id}`, payload);
    document.getElementById('modalEditarGasto').style.display = 'none';
    await cargarGastos();
  } catch (err) {
    console.error('Error actualizando gasto:', err);
    const msg = err?.response?.data?.message || 'No se pudo actualizar';
    alert(Array.isArray(msg) ? msg.join('\n') : msg);
  }
}

async function onHistorialGastosClick(e) {
  const btn = e.target.closest('[data-entity="gasto"][data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (!id) return;

  if (action === 'delete') {
    if (!confirm('¿Eliminar este gasto?')) return;
    try {
      await axios.delete(`/gastos/${id}`);
      await cargarGastos();
    } catch (err) {
      console.error('Error eliminando gasto:', err);
      alert('No se pudo eliminar el gasto');
    }
    return;
  }

  if (action === 'edit') {
    try {
      const res = await axios.get('/gastos');
      const row = (res.data || []).find((x) => String(x.id) === String(id));
      if (!row) {
        alert('No se encontró el gasto');
        return;
      }
      abrirModalEditarGasto(row);
    } catch (err) {
      console.error(err);
      alert('No se pudo cargar el gasto');
    }
  }
}
