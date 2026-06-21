document.addEventListener("DOMContentLoaded", () => {
    const planes = document.querySelectorAll(".plan");
    const resultado = document.getElementById("resultadoMembresia");
    const activarBtn = document.getElementById("activarMembresia");
  
    // Estado actual del usuario (usando localStorage como backend temporal)
    const usuario = JSON.parse(localStorage.getItem("usuario")) || {};
    const membresiaActual = usuario.membresia || "Free";
  
    // Show membresía activa al cargar
    const membresiaActiva = document.getElementById("membresiaActiva");
    if (membresiaActiva) {
      membresiaActiva.textContent = `Your current membership: ${membresiaActual}`;
    }
  
    let seleccion = "";
  
    // Selección de plan
    planes.forEach(plan => {
      plan.addEventListener("click", () => {
        planes.forEach(p => p.classList.remove("seleccionado"));
        plan.classList.add("seleccionado");
        seleccion = plan.dataset.plan;
        resultado.textContent = `You selected the plan: ${seleccion}`;
      });
    });
  
    // Activar membresía
    activarBtn.addEventListener("click", () => {
      if (!seleccion) {
        alert("⚠️ You must select a plan first.");
        return;
      }
  
      // Simulación de activación (en futuro será una API call)
      usuario.membresia = seleccion;
      localStorage.setItem("usuario", JSON.stringify(usuario));
      alert(`✅ Your membership was updated to: ${seleccion}`);
  
      if (membresiaActiva) {
        membresiaActiva.textContent = `Your current membership: ${seleccion}`;
      }
  
      resultado.textContent = "";
      planes.forEach(p => p.classList.remove("seleccionado"));
      seleccion = "";
    });
  });
  