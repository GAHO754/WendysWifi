// app.js
const formEl = document.getElementById("wifi-form");
const mensajeEl = document.getElementById("mensaje");
const submitBtn = formEl.querySelector('button[type="submit"]');

let isSubmitting = false;

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (isSubmitting) return;
  isSubmitting = true;

  const prevText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Conectando…";

  // Validaciones simples
  const nombre   = document.getElementById("nombre").value.trim();
  const correo   = document.getElementById("correo").value.trim();
  const telefono = document.getElementById("telefono").value.trim();
  const cumple   = document.getElementById("cumple").value;
  const acepta   = document.getElementById("acepta").checked;
  const empresa  = document.getElementById("empresa").value.trim(); // honeypot

  if (!acepta) {
    alert("Debes aceptar los términos");
    submitBtn.disabled = false; submitBtn.textContent = prevText; isSubmitting = false;
    return;
  }
  if (empresa !== "") {
    // Bot detectado; no enviamos nada
    submitBtn.disabled = false; submitBtn.textContent = prevText; isSubmitting = false;
    return;
  }

  const payload = {
    nombre,
    correo,
    telefono,
    cumple,
    acepta: !!acepta
  };

  try {
    const resp = await fetch("submit.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || "Error desconocido");

    // Éxito: ocultamos form y mostramos mensaje
    formEl.style.display = "none";
    mensajeEl.style.display = "block";

  } catch (err) {
    console.error("Fallo al enviar:", err);
    alert("Hubo un problema al registrar tus datos. Intenta nuevamente.");
    submitBtn.disabled = false; submitBtn.textContent = prevText; isSubmitting = false;
  }
});
