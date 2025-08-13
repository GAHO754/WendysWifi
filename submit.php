<?php
// submit.php
// --- Config ---
// Pon aquí TU URL del Web App de Apps Script (la que termina en /exec)
$GS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzSrpqiizNcI5p3d0v5gSpvCdqELvmtsBeIDDpVRc4a2ydBL23fmTjnqE5YlE-HkJUp/exec';

// Ruta del CSV (Excel-abrible). Asegúrate de que el servidor tenga permisos de escritura en esta carpeta.
$CSV_PATH = __DIR__ . '/registros.csv';
date_default_timezone_set('America/Mexico_City');

// ====== HEADERS / CORS ======
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS, GET');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); echo json_encode(['ok'=>true]); exit; }

// ====== RUTA DE PRUEBA PING ======
if (isset($_GET['ping'])) { echo json_encode(['ok'=>true, 'ping'=>'pong']); exit; }

// ====== DEBUG CONTROLADO (si necesitas ver errores en pantalla mientras pruebas)
// ini_set('display_errors', 1); error_reporting(E_ALL);

// ====== LEE PAYLOAD JSON ======
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!$data || !isset($data['nombre'],$data['correo'],$data['telefono'],$data['cumple'],$data['acepta'])) {
  http_response_code(400);
  echo json_encode(['ok'=>false,'error'=>'Payload inválido o incompleto','raw'=>$raw]);
  exit;
}

// ====== SANITIZA ======
function clean($s){ return trim(filter_var($s, FILTER_UNSAFE_RAW)); }
$nombre   = clean($data['nombre']);
$correo   = clean($data['correo']);
$telefono = preg_replace('/\D+/', '', (string)$data['telefono']);
$cumple   = clean($data['cumple']);
$acepta   = !!$data['acepta'];

// ====== GENERA docId y timestamp servidor ======
$docId = bin2hex(random_bytes(8));
$ts    = date('c'); // ISO8601

// ====== CSV: escribe encabezado si no existe ======
$needHeader = !file_exists($CSV_PATH) || filesize($CSV_PATH) === 0;
$fh = @fopen($CSV_PATH, 'a');
if ($fh === false) {
  http_response_code(500);
  echo json_encode(['ok'=>false, 'error'=>'No se pudo abrir/crear el CSV. Permisos de escritura insuficientes.', 'path'=>$CSV_PATH]);
  exit;
}
if ($needHeader) {
  fputcsv($fh, ['docId','timestamp','nombre','correo','telefono','cumple','acepta']);
}
fputcsv($fh, [$docId, $ts, $nombre, $correo, $telefono, $cumple, $acepta ? 'TRUE' : 'FALSE']);
fclose($fh);

// ====== REENVÍA A GOOGLE SHEETS ======
$payload = [
  'id'        => $docId,
  'timestamp' => $ts,
  'nombre'    => $nombre,
  'correo'    => $correo,
  'telefono'  => $telefono,
  'cumple'    => $cumple,
  'acepta'    => $acepta ? 'true' : 'false'
];

$gs_http = null; $gs_err = null; $gs_resp = null;

// Preferimos cURL si existe; si no, usamos file_get_contents
if (function_exists('curl_init')) {
  $ch = curl_init($GS_WEBAPP_URL);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_POST, true);
  // Puedes cambiar a JSON si tu Apps Script lo espera:
  // curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
  // curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
  // Enviamos form-urlencoded (lo soporta el script recomendado)
  curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($payload));
  $gs_resp = curl_exec($ch);
  $gs_err  = curl_error($ch);
  $gs_http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
} else {
  // Fallback sin cURL
  $ctx = stream_context_create([
    'http' => [
      'method'  => 'POST',
      'header'  => "Content-Type: application/x-www-form-urlencoded\r\n",
      'content' => http_build_query($payload),
      'ignore_errors' => true
    ]
  ]);
  $gs_resp = @file_get_contents($GS_WEBAPP_URL, false, $ctx);
  // Intentamos extraer el HTTP code
  if (isset($http_response_header) && preg_match('#HTTP/\S+\s+(\d{3})#', $http_response_header[0], $m)) {
    $gs_http = (int)$m[1];
  }
  $gs_err = $gs_resp === false ? 'file_get_contents failed' : null;
}

// No bloqueamos éxito por fallo del reenvío; ya guardamos CSV
echo json_encode([
  'ok' => true,
  'csv' => basename($CSV_PATH),
  'gs_webapp_http' => $gs_http,
  'gs_error' => $gs_err,
  'gs_response' => $gs_resp
]);
