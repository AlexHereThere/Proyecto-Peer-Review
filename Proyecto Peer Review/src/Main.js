/**
 * Main.gs - Punto de Entrada y Configuración de Vistas
 */

/**
 * Obtiene la instancia de la hoja de cálculo principal utilizando el ID
 * almacenado en las propiedades del script.
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} El objeto Spreadsheet.
 */
function getSpreed() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  return SpreadsheetApp.openById(id);
}

/**
 * Accede a una hoja específica dentro del Spreadsheet principal utilizando su nombre.
 * @param {string} nombre - El nombre de la pestaña/hoja (ej. "Documentos", "Usuarios").
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} El objeto de la hoja solicitada.
 */
function getSheetByName(nombre) {
  return getSpreed().getSheetByName(nombre);
}

/** Obtiene la hoja de "Usuarios". */
function getSheet_USR() { return getSpreed().getSheetByName("Usuarios"); }

/** Obtiene la hoja de "Documentos". */
function getSheet_DOC() { return getSpreed().getSheetByName("Documentos"); }

/** Obtiene la hoja de "Versiones". */
function getSheet_VER() { return getSpreed().getSheetByName("Versiones"); }

/** Obtiene la hoja de "Revisiones". */
function getSheet_REV() { return getSpreed().getSheetByName("Revisiones"); }

/** Obtiene la hoja de "Actividad". */
function getSheet_ACT() { return getSpreed().getSheetByName("Actividad"); }
function getSheet_CON() { return getSpreed().getSheetByName("Configuracion"); }

var Qunit = QUnitGS2.QUnit; // Pruebas Unitarias

/**
 * Función principal de Google Apps Script para manejar solicitudes GET.
 * Inicializa la infraestructura del sistema, procesa acciones de correos y sirve la interfaz.
 * @returns {HtmlService.HtmlOutput} El contenido HTML configurado.
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

function recargarSidebarHTML() {
  return HtmlService.createTemplateFromFile('component_sidebar').evaluate().getContent();
}