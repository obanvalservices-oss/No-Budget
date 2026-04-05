<!-- src/js/compartido.js (actualizado con permisos y ocultos) -->
<script>
  (function () {
    const q = (s, el=document) => el.querySelector(s);
    const qa = (s, el=document) => Array.from(el.querySelectorAll(s));

    // ====== INVITAR ======
    const formInv = q('#form-invitar');
    const outInv = q('#out-invitar');
    const limpiarBtn = q('#limpiarAsoc');

    formInv?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(formInv);
      const permisos = qa('select.vis').map(s => ({
        modulo: s.getAttribute('data-mod'),
        visibilidad: s.value,
      }));

      try {
        const res = await window.$api('/compartido/invitar', {
          method: 'POST',
          body: {
            partnerEmail: fd.get('partnerEmail'),
            partnerDisplayName: fd.get('partnerDisplayName') || '',
            relacion: fd.get('relacion'),
            aliasParaOwner: fd.get('partnerDisplayName') || null,
            permisos,
          }
        });
        localStorage.setItem('ASOC_ID', res.id);
        outInv.textContent = JSON.stringify(res, null, 2);
        alert('Invitación enviada. ASOC_ID guardado.');
      } catch (err) {
        outInv.textContent = err.message || String(err);
        alert('Error: ' + (err.message || ''));
      }
    });

    limpiarBtn?.addEventListener('click', () => {
      localStorage.removeItem('ASOC_ID');
      alert('ASOC_ID eliminado.');
    });

    // ====== ACEPTAR ======
    const formAcc = q('#form-aceptar');
    const outAcc = q('#out-aceptar');
    formAcc?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(formAcc);
      const id = (fd.get('asocId') || localStorage.getItem('ASOC_ID') || '').toString();
      if (!id) return alert('Falta ASOC_ID');

      try {
        const res = await window.$api(`/compartido/${id}/aceptar`, {
          method: 'POST',
          body: { aliasParaPartner: fd.get('aliasParaPartner') || null }
        });
        outAcc.textContent = JSON.stringify(res, null, 2);
        alert('Invitación aceptada.');
      } catch (err) {
        outAcc.textContent = err.message || String(err);
        alert('Error: ' + (err.message || ''));
      }
    });

    // ====== PERMISOS ======
    const asocPerms = q('#asocPerms');
    const btnCargarPerms = q('#btnCargarPerms');
    const btnGuardarPerms = q('#btnGuardarPerms');
    const outPerms = q('#out-perms');

    btnCargarPerms?.addEventListener('click', async () => {
      const id = (asocPerms.value || localStorage.getItem('ASOC_ID') || '').toString();
      if (!id) return alert('Falta ASOC_ID');
      try {
        const perms = await window.$api(`/compartido/${id}/permisos`, { method: 'GET' });
        const map = new Map(perms.map(p => [p.modulo, p.visibilidad]));
        q('#perm-ingresos').value = map.get('INGRESOS') || 'TOTAL';
        q('#perm-gastos').value = map.get('GASTOS') || 'TOTAL';
        q('#perm-ahorros').value = map.get('AHORROS') || 'TOTAL';
        q('#perm-inversiones').value = map.get('INVERSIONES') || 'TOTAL';
        outPerms.textContent = JSON.stringify(perms, null, 2);
      } catch (err) {
        outPerms.textContent = err.message || String(err);
        alert('Error: ' + (err.message || ''));
      }
    });

    btnGuardarPerms?.addEventListener('click', async () => {
      const id = (asocPerms.value || localStorage.getItem('ASOC_ID') || '').toString();
      if (!id) return alert('Falta ASOC_ID');
      try {
        const permisos = [
          { modulo: 'INGRESOS', visibilidad: q('#perm-ingresos').value },
          { modulo: 'GASTOS',   visibilidad: q('#perm-gastos').value },
          { modulo: 'AHORROS',  visibilidad: q('#perm-ahorros').value },
          { modulo: 'INVERSIONES', visibilidad: q('#perm-inversiones').value },
        ];
        const res = await window.$api(`/compartido/${id}/permisos`, {
          method: 'PATCH',
          body: { permisos }
        });
        outPerms.textContent = JSON.stringify(res, null, 2);
        alert('Permisos guardados.');
      } catch (err) {
        outPerms.textContent = err.message || String(err);
        alert('Error: ' + (err.message || ''));
      }
    });

    // ====== MOVIMIENTO COMPARTIDO ======
    const formMov = q('#form-mov');
    const outMov = q('#out-mov');
    formMov?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(formMov);
      const id = (fd.get('asocId') || localStorage.getItem('ASOC_ID') || '').toString();
      if (!id) return alert('Falta ASOC_ID');

      try {
        const body = {
          modulo: fd.get('modulo'),
          concepto: fd.get('concepto'),
          montoTotal: Number(fd.get('montoTotal')),
          fecha: new Date(fd.get('fecha')).toISOString(),
        };
        const res = await window.$api(`/compartido/${id}/movimientos`, { method: 'POST', body });
        outMov.textContent = JSON.stringify(res, null, 2);
        alert('Movimiento creado.');
      } catch (err) {
        outMov.textContent = err.message || String(err);
        alert('Error: ' + (err.message || ''));
      }
    });

    // ====== DASHBOARD + OCULTOS ======
    const btnDash = q('#btnDash');
    const asocDash = q('#asocDash');
    const totales = q('#totales');
    const items = q('#items');
    const ocultosList = q('#ocultos');

    async function cargarOcultos(id) {
      // limpia (deja cabecera)
      qa('.row.data', ocultosList).forEach(n => n.remove());
      try {
        const list = await window.$api(`/compartido/${id}/ocultos`, { method: 'GET' });
        list.forEach(o => {
          const row = document.createElement('div');
          row.className = 'row data';
          row.style.gridTemplateColumns = '1fr 140px 160px 120px';
          const c1 = document.createElement('div'); c1.textContent = o.recordId;
          const c2 = document.createElement('div'); c2.textContent = o.modulo;
          const c3 = document.createElement('div'); c3.textContent = String(o.sourceUserId);
          const c4 = document.createElement('div');
          const btn = document.createElement('button'); btn.className = 'secondary'; btn.textContent = 'Mostrar';
          btn.onclick = async () => {
            try {
              await window.$api(`/compartido/${id}/ocultos`, {
                method: 'PATCH',
                body: { remove: [{ modulo: o.modulo, recordId: o.recordId, sourceUserId: o.sourceUserId }] }
              });
              await cargarDashboard(id);
            } catch (err) { alert('Error: ' + (err.message || '')); }
          };
          c4.appendChild(btn);
          row.appendChild(c1); row.appendChild(c2); row.appendChild(c3); row.appendChild(c4);
          ocultosList.appendChild(row);
        });
      } catch (err) {
        // no bloquear UI
      }
    }

    async function cargarDashboard(id) {
      try {
        const data = await window.$api(`/compartido/${id}/dashboard`, { method: 'GET' });
        totales.textContent = JSON.stringify(data.total || {}, null, 2);

        // limpia filas previas (excepto cabecera)
        qa('.row.data', items).forEach(n => n.remove());

        (data.items || []).forEach(it => {
          const concepto = it.fuente || it.descripcion || it.objetivo || it.activo || '—';
          const modulo = it.modulo || '—';
          const monto = it.monto ?? it.montoTotal ?? ((it.cantidad || 0) * (it.precioActual || 0)) ?? 0;

          const row = document.createElement('div');
          row.className = 'row data';
          row.style.gridTemplateColumns = '1fr 120px 120px 120px';

          const c1 = document.createElement('div'); c1.textContent = concepto;
          const c2 = document.createElement('div'); c2.textContent = modulo;
          const c3 = document.createElement('div'); c3.className = 'monto'; c3.textContent = Number(monto || 0).toFixed(2);
          const c4 = document.createElement('div');
          const btn = document.createElement('button'); btn.className = 'secondary'; btn.textContent = 'Ocultar';
          btn.onclick = async () => {
            try {
              await window.$api(`/compartido/${id}/ocultos`, {
                method: 'PATCH',
                body: { add: [{ modulo, recordId: String(it.id), sourceUserId: it.userId }] }
              });
              await cargarDashboard(id);
            } catch (err) { alert('Error: ' + (err.message || '')); }
          };
          c4.appendChild(btn);

          row.appendChild(c1); row.appendChild(c2); row.appendChild(c3); row.appendChild(c4);
          items.appendChild(row);
        });

        await cargarOcultos(id);
      } catch (err) {
        totales.textContent = err.message || String(err);
        alert('Error: ' + (err.message || ''));
      }
    }

    btnDash?.addEventListener('click', async () => {
      const id = (asocDash.value || localStorage.getItem('ASOC_ID') || '').toString();
      if (!id) return alert('Falta ASOC_ID');
      await cargarDashboard(id);
    });

    // precargar ASOC_ID si existe
    const preset = localStorage.getItem('ASOC_ID');
    if (preset && asocDash) asocDash.value = preset;
  })();
</script>
