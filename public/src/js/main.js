document.addEventListener('DOMContentLoaded', () => {
  const resumenContainer = document.querySelector('.resumen-dashboard');
  const config = JSON.parse(localStorage.getItem('config'));

  if (!config || !config.fechaBase) {
    resumenContainer.innerHTML = '<p>Configura primero tu fecha base desde el perfil.</p>';
    return;
  }

  const fechaBase = new Date(config.fechaBase);
  const inicioSemana = parseInt(config.inicioSemana);

  const datos = {
    ingresos: JSON.parse(localStorage.getItem('ingresos')) || [],
    gastos: JSON.parse(localStorage.getItem('gastos')) || [],
    ahorros: JSON.parse(localStorage.getItem('ahorros')) || [],
    inversiones: JSON.parse(localStorage.getItem('inversiones')) || [],
  };

  const agruparPorSemana = (items) => {
    const semanas = {};
    items.forEach(item => {
      const fecha = new Date(item.fecha);
      const semana = obtenerSemanaCorrespondiente(fecha);
      if (!semanas[semana]) semanas[semana] = [];
      semanas[semana].push(item);
    });
    return semanas;
  };

  const obtenerSemanaCorrespondiente = (fecha) => {
    const base = new Date(fechaBase);
    const diff = Math.floor((fecha - base) / (1000 * 60 * 60 * 24));
    const offset = (7 + fecha.getDay() - inicioSemana) % 7;
    const diasDesdeInicio = diff - offset;
    const inicio = new Date(base);
    inicio.setDate(inicio.getDate() + diasDesdeInicio);
    return inicio.toISOString().split('T')[0]; // clave de semana
  };

  const semanas = {};

  // Agrupamos cada tipo
  Object.keys(datos).forEach(tipo => {
    const agrupados = agruparPorSemana(datos[tipo]);
    Object.entries(agrupados).forEach(([semana, items]) => {
      if (!semanas[semana]) semanas[semana] = { ingresos: [], gastos: [], ahorros: [], inversiones: [] };
      semanas[semana][tipo] = items;
    });
  });

  const semanasOrdenadas = Object.keys(semanas).sort();

  resumenContainer.innerHTML = '';

  semanasOrdenadas.forEach(semana => {
    const inicioSemana = new Date(semana);
    const finSemana = new Date(inicioSemana);
    finSemana.setDate(inicioSemana.getDate() + 6);
    const resumen = semanas[semana];

    const totalIngresos = resumen.ingresos.reduce((acc, i) => acc + i.monto, 0);
    const totalGastos = resumen.gastos.reduce((acc, i) => acc + i.monto, 0);
    const totalAhorros = resumen.ahorros.reduce((acc, i) => acc + i.monto, 0);
    const totalInversiones = resumen.inversiones.reduce((acc, i) => acc + i.monto, 0);

    const balanceFinal = totalIngresos - totalGastos - totalAhorros - totalInversiones;

    const section = document.createElement('section');
    section.classList.add('semana-resumen');
    section.innerHTML = `
      <h3>Semana del ${inicioSemana.toLocaleDateString()} al ${finSemana.toLocaleDateString()}</h3>

      ${resumen.ingresos.map(i => `<p>Ingreso - ${i.categoria || 'Sin nombre'}: $${i.monto.toFixed(2)}</p>`).join('')}
      <p><strong>Total Ingreso Semanal: $${totalIngresos.toFixed(2)}</strong></p>

      ${resumen.inversiones.map(i => `<p>Inversión - ${i.categoria || 'Sin nombre'}: $${i.monto.toFixed(2)}</p>`).join('')}
      ${resumen.ahorros.map(i => `<p>Ahorro - ${i.categoria || 'Sin nombre'}: $${i.monto.toFixed(2)}</p>`).join('')}
      <p><strong>Total Ahorro e Inversiones Semanal: $${(totalAhorros + totalInversiones).toFixed(2)}</strong></p>

      ${resumen.gastos.map(i => `<p>Gasto - ${i.categoria || 'Sin nombre'}: $${i.monto.toFixed(2)}</p>`).join('')}
      <p><strong>Total Gastos Semanal: $${totalGastos.toFixed(2)}</strong></p>

      <p><strong>Balance at the end of the week: $${balanceFinal.toFixed(2)}</strong></p>
      <hr />
    `;
    resumenContainer.appendChild(section);
  });
});

