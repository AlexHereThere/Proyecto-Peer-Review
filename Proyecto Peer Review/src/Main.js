/**
 * Main.js - Punto de Entrada y Configuración de Vistas
 */

/** @type {QUnit} Instancia de QUnit para pruebas unitarias. */
var Qunit = QUnitGS2.QUnit;

/**
 * Obtiene los datos iniciales necesarios para arrancar la aplicación en una sola llamada.
 * @returns {Object} Objeto con información del usuario y sus permisos/roles.
 */
function getAppData() {
  const user = sacarGoogleInfoUsuario();
  const perms = inicializarUsuario();
  return { user, perms };
}

/**
 * Función principal de Google Apps Script para manejar solicitudes GET.
 * Inicializa la infraestructura del sistema, procesa acciones de correos y sirve la interfaz.
 * @param {Object} e - Objeto de evento de la solicitud GET.
 * @returns {GoogleAppsScript.HTML.HtmlOutput} El contenido HTML configurado.
 */
function doGet(e) {
  // --- 1. MODO: PRUEBAS UNITARIAS ---
  if (e && e.parameter && e.parameter.mode === 'test') { // ?mode=test
    QUnitGS2.init();
    definirPruebasUnitarias();
    QUnitGS2.QUnit.start();
    return QUnitGS2.getHtml();
  }

  // --- 2. MODO: ACCIÓN DESDE CORREO ELECTRÓNICO (NUEVO INTERCEPTOR) ---
  // Si la URL contiene el parámetro "action" (ej: ?action=aceptar&id=...), 
  // detenemos la carga normal y procesamos la aceptación/rechazo.
  if (e && e.parameter && e.parameter.action) {
    return manejarAccionCorreo(e.parameter); 
  }

  // --- 3. MODO: CARGA NORMAL DE LA APLICACIÓN ---
  inicializarSistema();

  const template = HtmlService.createTemplateFromFile('index');
  const output = template.evaluate(); 
  
  output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  output.setTitle("Evaluapares UABC");
  output.addMetaTag('viewport', 'width=device-width, initial-scale=1');
  
  return output;
}

/**
 * Obtiene los resultados de las pruebas desde el servidor.
 * @returns {Object} Los resultados de QUnit.
 */
function getResultsFromServer() {
   return QUnitGS2.getResultsFromServer();
}

/**
 * Incluye el contenido de archivos HTML (CSS o JS) dentro de la plantilla principal.
 * @param {string} filename - Nombre del archivo sin la extensión .html.
 * @returns {string} El contenido de texto del archivo.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Carga y evalúa una vista HTML específica para su renderizado dinámico.
 * @param {string} nombre - El nombre del archivo de la vista (ej. 'Dashboard').
 * @returns {string} El contenido HTML procesado.
 */
function getVista(nombre){
  const template = HtmlService.createTemplateFromFile(nombre);
  return template.evaluate().getContent();
}

/**
 * Recarga el contenido HTML del componente sidebar.
 * @returns {string} El contenido HTML del sidebar procesado.
 */
function recargarSidebarHTML() {
  return HtmlService.createTemplateFromFile('component_sidebar').evaluate().getContent();
}