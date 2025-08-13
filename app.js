// app.js — envía DIRECTO a Google Sheets (Apps Script), sin Firebase ni PHP

// 1) CONFIGURA TU WEB APP URL:
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzSrpqiizNcI5p3d0v5gSpvCdqELvmtsBeIDDpVRc4a2ydBL23fmTjnqE5YlE-HkJUp/exec'; // ej: https://script.google.com/macros/s/XXXX/exec

// 2) Util: UUID v4 para docId (anti-duplicados en el Apps Script)
function uuidv4() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  // fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

// 3) POST por formulario oculto (evita bloqueos CSP y NO redirige gracias a iframe)
function postViaHiddenForm(url, data) {
  let sink = document.getElementById("sheet-post-sink");
  if (!sink) {
    sink = document.createElement("iframe");
    sink.name = "sheet-post-sink";
    sink.id = "sheet-post-sink";
    sink.style.display = "none";
    document.body.appendChild(sink);
  }
  const f = document.createElement("form");
  f.action = url;
  f.method = "POST";
  f.target = "sheet-post-sink";
  f.style.display = "none";
  for (const [k, v] of Object.entries(data)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = k;
    input.value = String(v ?? "");
    f.appendChild(input);
  }
  document.body.appendChild(f);
  try { f.submit(); } finally {
    setTimeout(() => f.remove(), 3000);
  }
}

// 4) Manejo del formulario
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
    // Bot detectado; no enviamos
    submitBtn.disabled = false; submitBtn.textContent = prevText; isSubmitting = false;
    return;
  }

  const payload = {
    id: uuidv4(),                          // docId generado en el cliente
    timestamp: new Date().toISOString(),   // hora del cliente
    nombre, correo, telefono, cumple, acepta: acepta ? 'true' : 'false'
  };

  try {
    // A) Intento 1: sendBeacon (no bloquea la navegación) — puede fallar por CSP
    let beaconOk = false;
    if ('sendBeacon' in navigator) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      beaconOk = navigator.sendBeacon(WEBAPP_URL, blob);
    }

    // B) Intento 2: fetch JSON (no-cors). Puede ser bloqueado por connect-src.
    if (!beaconOk) {
      fetch(WEBAPP_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).catch(() => { /* ignorable */ });
    }

    // C) Fallback seguro: formulario oculto (form-urlencoded) hacia Apps Script
    postViaHiddenForm(WEBAPP_URL, payload);

    // UI éxito
    formEl.style.display = "none";
    mensajeEl.style.display = "block";

  } catch (err) {
    console.error("Fallo al enviar:", err);
    alert("Hubo un problema al registrar tus datos. Intenta nuevamente.");
    submitBtn.disabled = false; submitBtn.textContent = prevText; isSubmitting = false;
  }
});
