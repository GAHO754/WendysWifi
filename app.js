// 1) Pega aquí TU Web App URL:
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbw-Ru0obI_OyRYotHr9Y5boZtmOFsFfOjbyxT-cujYFLCFminFNgR-h82VRjNMUrjvX/exec';

// 2) UUID para docId (anti-duplicados)
function uuidv4() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

// 3) POST vía formulario oculto (evita bloqueos y NO redirige)
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
  try { f.submit(); } finally { setTimeout(() => f.remove(), 3000); }
}

// 4) Manejo del formulario
const formEl = document.getElementById("wifi-form");
const mensajeEl = document.getElementById("mensaje");
const submitBtn = formEl.querySelector('button[type="submit"]');

let isSubmitting = false;

formEl.addEventListener("submit", (e) => {
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
  if (!acepta) {
    alert("Debes aceptar los términos");
    submitBtn.disabled = false; submitBtn.textContent = prevText; isSubmitting = false;
    return;
  }

  const payload = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    nombre, correo, telefono, cumple,
    acepta: acepta ? 'true' : 'false'
  };

  // A) Intento con sendBeacon (si existe)
  let beaconOk = false;
  if ('sendBeacon' in navigator) {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    beaconOk = navigator.sendBeacon(WEBAPP_URL, blob);
  }

  // B) Intento con fetch (no-cors). Si tu CSP lo bloquea, no pasa nada.
  if (!beaconOk) {
    fetch(WEBAPP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => { /* ignorable */ });
  }

  // C) Fallback seguro: formulario oculto (form-urlencoded)
  postViaHiddenForm(WEBAPP_URL, payload);

  // UI éxito
  formEl.style.display = "none";
  mensajeEl.style.display = "block";
});
