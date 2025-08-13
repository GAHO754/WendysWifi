<?php
// submit.php
// --- Config ---
// Pon aquí TU URL del Web App de Apps Script (la que termina en /exec)
$GS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzSrpqiizNcI5p3d0v5gSpvCdqELvmtsBeIDDpVRc4a2ydBL23fmTjnqE5YlE-HkJUp/exec';

// Ruta del CSV (Excel-abrible). Asegúrate de que el servidor tenga permisos de escritura en esta carpeta.
$CSV_PATH = __DIR__ . '/registros.csv';

// Zona horaria para timestamps del servidor
date_default_timezone_set('America/Mexico_City');

// --- Seguridad básica CORS (mismo origen no lo necesita, pero ayuda si mueves front a otro host) ---
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// --- Leer JSON del cliente ---
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!$data || !isset($data['nombre'], $data['correo'], $data['telefono'], $data['cumple'], $data['acepta'])) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Payload inválido']);
  exit;
}

// Sanitizar básico
function clean($s) { return trim(filter_var($s, FILTER_UNSAFE_RAW)); }

$nombre   = clean($data['nombre']);
$correo   = clean($data['correo']);
$telefono = preg_replace('/\D+/', '', $data['telefono']); // solo dígitos
$cumple   = clean($data['cumple']);
$acepta   = !!$data['acepta'];

// Generamos un ID único para anti-duplicados en el Sheet
$docId    = bin2hex(random_bytes(8)); // 16 hex chars
$ts       = date('c'); // ISO8601 del servidor

// --- 1) Guardar en CSV (Excel) ---
$csvHeader = ['docId','timestamp','nombre','correo','telefono','cumple','acepta'];
$csvRow    = [$docId, $ts, $nombre, $correo, $telefono, $cumple, $acepta ? 'TRUE' : 'FALSE'];

$needHeader = !file_exists($CSV_PATH) || filesize($CSV_PATH) === 0;

$fh = @fopen($CSV_PATH, 'a');
if ($fh === false) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'No se pudo abrir/crear el CSV en el servidor']);
  exit;
}
if ($needHeader) {
  fputcsv($fh, $csvHeader);
}
fputcsv($fh, $csvRow);
fclose($fh);

// --- 2) Reenviar a Google Sheets (Apps Script Web App) ---
$payload = [
  'id'        => $docId,
  'timestamp' => $ts,
  'nombre'    => $nombre,
  'correo'    => $correo,
  'telefono'  => $telefono,
  'cumple'    => $cumple,
  'acepta'    => $acepta ? 'true' : 'false'
];

$ch = curl_init($GS_WEBAPP_URL);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);

// Puedes elegir JSON O form-urlencoded. Ambos los soporta el Apps Script que te di.
// --- JSON (descomenta estas 2 líneas y comenta el form-urlencoded si prefieres JSON) ---
// curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
// curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

// --- Form-urlencoded (recomendado si dejaste el doPost con soporte a ambos) ---
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($payload));

$resp = curl_exec($ch);
$err  = curl_error($ch);
$http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// Nota: aunque el Web App falle, ya guardamos en CSV. Reportamos ok=true pero
// devolvemos meta para depurar si quieres.
echo json_encode([
  'ok' => true,
  'csv' => basename($CSV_PATH),
  'gs_webapp_http' => $http,
  'gs_error' => $err ?: null,
  'gs_response' => $resp ?: null
]);
