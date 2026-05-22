/**
 * BaseDatos.js - Capa de Acceso a Datos (DAO) con Caché de Sesión
 * Centraliza la conexión con el Spreadsheet y optimiza el rendimiento
 * evitando lecturas repetitivas de las hojas.
 */

/** @private Objeto para almacenar datos de hojas ya leídas en la ejecución actual. */
const _CACHE_DATOS = {};

/**
 * Obtiene la instancia de la hoja de cálculo principal utilizando el ID.
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} El objeto Spreadsheet.
 */
function getSpreed() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  return SpreadsheetApp.openById(id);
}

/**
 * Obtiene los valores de una hoja completa, utilizando caché si ya fue solicitada.
 */
function getSheetData(nombreHoja) {
  if (_CACHE_DATOS[nombreHoja]) return _CACHE_DATOS[nombreHoja];
  const ss = getSpreed();
  const sheet = ss ? ss.getSheetByName(nombreHoja) : null;
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  _CACHE_DATOS[nombreHoja] = data;
  return data;
}

/**
 * Busca una fila en una hoja basándose en un valor de una columna específica.
 * @param {string} nombreHoja - Nombre de la hoja.
 * @param {number} colIndex - Índice de la columna (0-based).
 * @param {any} valorBuscado - El valor a encontrar.
 * @returns {Array|null} La fila encontrada o null.
 */
function findRowInSheet(nombreHoja, colIndex, valorBuscado) {
  const data = getSheetData(nombreHoja);
  const busqueda = String(valorBuscado).trim().toLowerCase();
  return data.find(row => String(row[colIndex]).trim().toLowerCase() === busqueda) || null;
}

/**
 * Filtra filas en una hoja basándose en un valor de una columna específica.
 * @param {string} nombreHoja - Nombre de la hoja.
 * @param {number} colIndex - Índice de la columna (0-based).
 * @param {any} valorBuscado - El valor a filtrar.
 * @returns {Array<Array>} Arreglo de filas encontradas.
 */
function filterRowsInSheet(nombreHoja, colIndex, valorBuscado) {
  const data = getSheetData(nombreHoja);
  const busqueda = String(valorBuscado).trim().toLowerCase();
  return data.filter(row => String(row[colIndex]).trim().toLowerCase() === busqueda);
}

/**
 * Accede a una hoja específica dentro del Spreadsheet principal.
 */
function getSheetByName(nombre) {
  const ss = getSpreed();
  return ss ? ss.getSheetByName(nombre) : null;
}

/** 
 * Obtiene la hoja de "Usuarios". 
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} La hoja de Usuarios.
 */
function getSheet_USR() { 
  return getSheetByName("Usuarios"); 
}

/** 
 * Obtiene la hoja de "Documentos". 
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} La hoja de Documentos.
 */
function getSheet_DOC() { 
  return getSheetByName("Documentos"); 
}

/** 
 * Obtiene la hoja de "Versiones". 
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} La hoja de Versiones.
 */
function getSheet_VER() { 
  return getSheetByName("Versiones"); 
}

/** 
 * Obtiene la hoja de "Revisiones". 
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} La hoja de Revisiones.
 */
function getSheet_REV() { 
  return getSheetByName("Revisiones"); 
}

/** 
 * Obtiene la hoja de "Actividad". 
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} La hoja de Actividad.
 */
function getSheet_ACT() { 
  return getSheetByName("Actividad"); 
}

/**
 * Garantiza la existencia de una hoja y sus cabeceras. Si no existe, la crea.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss - Instancia de la hoja de cálculo.
 * @param {string} nombre - Nombre de la hoja deseada.
 * @param {Array<string>} cabeceras - Lista de títulos para la primera fila.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} La hoja asegurada.
 */
function asegurarHoja(ss, nombre, cabeceras) {
  let sheet = ss.getSheetByName(nombre);
  if (!sheet) {
    sheet = ss.insertSheet(nombre);
    sheet.getRange(1, 1, 1, cabeceras.length).setValues([cabeceras]).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Limpia la caché interna de datos. Útil para entornos de prueba (Unit Tests).
 */
function limpiarCacheDatos() {
  for (const key in _CACHE_DATOS) {
    delete _CACHE_DATOS[key];
  }
}
