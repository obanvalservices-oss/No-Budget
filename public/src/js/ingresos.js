/**
 * Ingresos — categorías INGRESOS (mayúsculas). categoria = nombre (texto).
 */

const MODULO_CATEGORIAS = 'INGRESOS';

document.addEventListener('DOMContentLoaded', async () => {
  const listaRoot = document.getElementById('listaIngresos');
  listaRoot.addEventListener('click', onListaIngresosClick);

  await cargarCategorias();
  wireCategoriaSelect();
  await cargarIngresos();

  document.getElementById('formIngreso').addEventListener('submit', onSubmitIngreso);

  const modal = document.getElementById('modalEditarIngreso');
  document.getElementById('btnCancelarEditIngreso').addEventListener('click', () => {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
  });
  document.getElementById('formEditarIngreso').addEventListener('submit', onSubmitEditarIngreso);
});

function wireCategoriaSelect() {
  const select = document.getElementById('categoriaIngreso');
  const inputNueva = document.getElementById('nuevaCategoriaInput');
  select.addEventListener('change', () => {
    if (select.value === 'crear-nueva') {
      inputNueva.classList.add('is-visible');
      inputNueva.focus();
    } else {
      inputNueva.classList.remove('is-visible');
      inputNueva.value = '';
    }
  });
}

async function cargarCategorias() {
  const select = document.getElementById('categoriaIngreso');
  select.innerHTML = '<option value="">Selecciona una categoría</option>';
  try {
    const res = await axios.get(`/categorias/${MODULO_CATEGORIAS}`);
    (res.data || []).forEach((cat) => {
      const option = document.createElement('option');
      option.value = cat.nombre;
      option.textContent = cat.nombre;
      select.appendChild(option);
    });
    const nueva = document.createElement('option');
    nueva.value = 'crear-nueva';
    nueva.textContent = '➕ Crear nueva categoría…';
    select.appendChild(nueva);
  } catch (err) {
    console.error('Error cargando categorías:', err);
  }
}

function syncEditModalCategorias() {
  const main = document.getElementById('categoriaIngreso');
  const modalSel = document.getElementById('editCategoriaIngreso');
  modalSel.innerHTML = '';
  [...main.options].forEach((opt) => {
    if (!opt.value || opt.value === 'crear-nueva') return;
    modalSel.appendChild(opt.cloneNode(true));
  });
}

async function resolverNombreCategoria() {
  const select = document.getElementById('categoriaIngreso');
  const inputNueva = document.getElementById('nuevaCategoriaInput');

  if (select.value === 'crear-nueva') {
    const nombre = (inputNueva.value || '').trim();
    if (!nombre) {
      alert('Escribe el nombre de la nueva categoría');
      return null;
    }
    try {
      await axios.post('/categorias', { nombre, modulo: MODULO_CATEGORIAS });
      await cargarCategorias();
      select.value = nombre;
      inputNueva.classList.remove('is-visible');
      inputNueva.value = '';
      return nombre;
    } catch (err) {
      console.error('Error creando categoría:', err);
      const msg = err?.response?.data?.message || 'No se pudo crear la categoría';
      alert(Array.isArray(msg) ? msg.join('\n') : msg);
      return null;
    }
  }

  if (!select.value || select.value === 'crear-nueva') return null;
  return select.value;
}

async function onSubmitIngreso(e) {
  e.preventDefault();
  const form = e.target;

  const categoria = await resolverNombreCategoria();
  if (!categoria) {
    alert('Selecciona una categoría o crea una nueva');
    return;
  }

  const nuevoIngreso = {
    fuente: document.getElementById('fuente').value.trim(),
    monto: parseFloat(document.getElementById('montoIngreso').value),
    frecuencia: document.getElementById('frecuenciaIngreso').value,
    fecha: document.getElementById('fechaIngreso').value,
    fijo: document.getElementById('fijoIngreso').checked,
    categoria,
  };

  try {
    await axios.post('/ingresos', nuevoIngreso);
    form.reset();
    document.getElementById('nuevaCategoriaInput').classList.remove('is-visible');
    await cargarCategorias();
    await cargarIngresos();
  } catch (err) {
    console.error('Error guardando ingreso:', err);
    const msg = err?.response?.data?.message || 'No se pudo guardar el ingreso';
    alert(Array.isArray(msg) ? msg.join('\n') : msg);
  }
}

async function cargarIngresos() {
  try {
    const res = await axios.get('/ingresos');
    renderIngresos(res.data || []);
  } catch (err) {
    console.error('Error al cargar ingresos:', err);
  }
}

function formatIngresoFecha(fechaVal) {
  if (!fechaVal) return '—';
  const d = new Date(fechaVal);
  return Number.isNaN(+d) ? String(fechaVal) : d.toLocaleDateString();
}

function renderIngresos(ingresos) {
  const contenedor = document.getElementById('listaIngresos');
  contenedor.innerHTML = '';

  if (!ingresos.length) {
    contenedor.innerHTML = '<p class="vacio">No hay ingresos registrados.</p>';
    return;
  }

  const actions = (id) => window.nbHistorialPair('ingreso', id);

  ingresos.forEach((ingreso) => {
    const item = document.createElement('div');
    item.className = 'nb-historial-item ingreso-item';
    const cat = ingreso.categoria
      ? `<span class="ingreso-cat">${escapeHtml(String(ingreso.categoria))}</span>`
      : '';
    item.innerHTML = `
      <div class="nb-historial-body ingreso-info">
        <p class="nb-historial-title">${escapeHtml(ingreso.fuente)}</p>
        <p class="nb-historial-meta">${escapeHtml(formatIngresoFecha(ingreso.fecha))}${ingreso.frecuencia ? ` · ${escapeHtml(ingreso.frecuencia)}` : ''}${ingreso.fijo ? ' · Fijo' : ''}</p>
        ${cat}
      </div>
      <div class="ingreso-monto-acciones" style="display:flex;align-items:center;gap:0.75rem;">
        <span class="nb-historial-amount ingreso-monto">$${Number(ingreso.monto).toFixed(2)}</span>
        ${actions(ingreso.id)}
      </div>
    `;
    contenedor.appendChild(item);
  });
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function abrirModalEditarIngreso(ingreso) {
  syncEditModalCategorias();
  document.getElementById('editIngresoId').value = ingreso.id;
  document.getElementById('editFuenteIng').value = ingreso.fuente || '';
  document.getElementById('editMontoIng').value = ingreso.monto ?? '';
  document.getElementById('editFrecuenciaIng').value = ingreso.frecuencia || 'Único';
  const fd = ingreso.fecha ? new Date(ingreso.fecha) : null;
  document.getElementById('editFechaIng').value =
    fd && !Number.isNaN(+fd) ? fd.toISOString().slice(0, 10) : '';
  document.getElementById('editFijoIng').checked = !!ingreso.fijo;
  const catSel = document.getElementById('editCategoriaIngreso');
  catSel.value = ingreso.categoria || '';
  if (!catSel.value && catSel.options.length) catSel.selectedIndex = 0;

  const modal = document.getElementById('modalEditarIngreso');
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
}

async function onSubmitEditarIngreso(e) {
  e.preventDefault();
  const id = document.getElementById('editIngresoId').value;
  const payload = {
    fuente: document.getElementById('editFuenteIng').value.trim(),
    monto: parseFloat(document.getElementById('editMontoIng').value),
    frecuencia: document.getElementById('editFrecuenciaIng').value,
    fecha: document.getElementById('editFechaIng').value,
    fijo: document.getElementById('editFijoIng').checked,
    categoria: document.getElementById('editCategoriaIngreso').value,
  };

  try {
    await axios.patch(`/ingresos/${id}`, payload);
    document.getElementById('modalEditarIngreso').style.display = 'none';
    await cargarIngresos();
  } catch (err) {
    console.error('Error actualizando ingreso:', err);
    const msg = err?.response?.data?.message || 'No se pudo actualizar';
    alert(Array.isArray(msg) ? msg.join('\n') : msg);
  }
}

async function onListaIngresosClick(e) {
  const btn = e.target.closest('[data-entity="ingreso"][data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (!id) return;

  if (action === 'delete') {
    if (!confirm('¿Eliminar este ingreso?')) return;
    try {
      await axios.delete(`/ingresos/${id}`);
      await cargarIngresos();
    } catch (err) {
      console.error('Error eliminando ingreso:', err);
      alert('No se pudo eliminar el ingreso');
    }
    return;
  }

  if (action === 'edit') {
    try {
      const res = await axios.get('/ingresos');
      const row = (res.data || []).find((x) => String(x.id) === String(id));
      if (!row) {
        alert('No se encontró el ingreso');
        return;
      }
      abrirModalEditarIngreso(row);
    } catch (err) {
      console.error(err);
      alert('No se pudo cargar el ingreso');
    }
  }
}
