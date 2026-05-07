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
 * Esta función depende de la existencia de getSpreed() para obtener el Spreadsheet activo.
 * * @param {string} nombre - El nombre de la pestaña/hoja (ej. "Documentos", "Usuarios").
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} El objeto de la hoja solicitada.
 */
function getSheetByName(nombre) {
  return getSpreed().getSheetByName(nombre);
}

/**
 * Obtiene la hoja de "Usuarios".
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet_USR() { return getSpreed().getSheetByName("Usuarios"); }

/**
 * Obtiene la hoja de "Documentos".
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet_DOC() { return getSpreed().getSheetByName("Documentos"); }

/**
 * Obtiene la hoja de "Versiones".
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet_VER() { return getSpreed().getSheetByName("Versiones"); }

/**
 * Obtiene la hoja de "Revisiones".
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet_REV() { return getSpreed().getSheetByName("Revisiones"); }

/**
 * Obtiene la hoja de "Actividad".
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet_ACT() { return getSpreed().getSheetByName("Actividad"); }


var Qunit = QUnitGS2.QUnit; // Pruebas Unitarias

/**
 * Función principal de Google Apps Script para manejar solicitudes GET.
 * Inicializa la infraestructura del sistema y sirve la interfaz de usuario.
 * @returns {HtmlService.HtmlOutput} El contenido HTML configurado.
 */
function doGet(e) {
  // --- Para Pruebas Unitarias ---
  if (e && e.parameter && e.parameter.mode === 'test') { //?mode=test
    QUnitGS2.init();
    
    //PU_Revisiones(); 
    definirPruebasUnitarias();

    QUnitGS2.QUnit.start();
    return QUnitGS2.getHtml();
  }

  // --- Aplicacion ---
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