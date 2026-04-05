document.addEventListener("DOMContentLoaded", () => {
    const planes = document.querySelectorAll(".plan");
    const resultado = document.getElementById("resultadoMembresia");
    const activarBtn = document.getElementById("activarMembresia");
  
    // Estado actual del usuario (usando localStorage como backend temporal)
    const usuario = JSON.parse(localStorage.getItem("usuario")) || {};
    const membresiaActual = usuario.membresia || "Free";
  
    // Mostrar membresía activa al cargar
    const membresiaActiva = document.getElementById("membresiaActiva");
    if (membresiaActiva) {
      membresiaActiva.textContent = `Tu membresía actual: ${membresiaActual}`;
    }
  
    let seleccion = "";
  
    // Selección de plan
    planes.forEach(plan => {
      plan.addEventListener("click", () => {
        planes.forEach(p => p.classList.remove("seleccionado"));
        plan.classList.add("seleccionado");
        seleccion = plan.dataset.plan;
        resultado.textContent = `Has seleccionado el plan: ${seleccion}`;
      });
    });
  
    // Activar membresía
    activarBtn.addEventListener("click", () => {
      if (!seleccion) {
        alert("⚠️ Primero debes seleccionar un plan.");
        return;
      }
  
      // Simulación de activación (en futuro será una API call)
      usuario.membresia = seleccion;
      localStorage.setItem("usuario", JSON.stringify(usuario));
      alert(`✅ Tu membresía ha sido actualizada a: ${seleccion}`);
  
      if (membresiaActiva) {
        membresiaActiva.textContent = `Tu membresía actual: ${seleccion}`;
      }
  
      resultado.textContent = "";
      planes.forEach(p => p.classList.remove("seleccionado"));
      seleccion = "";
    });
  });
  