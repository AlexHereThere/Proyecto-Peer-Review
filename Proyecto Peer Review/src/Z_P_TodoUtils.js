/** * @typedef {Object} RastreoTest
 * @property {Set<string>} docs - IDs de documentos raíz.
 * @property {Set<string>} versiones - IDs de versiones.
 * @property {Set<string>} revisiones - IDs de revisiones.
 * @property {Set<string>} usuarios - Emails de usuarios.
 * @property {Set<string>} actividades - Nombres de actividades/eventos.
 * @property {Set<string>} carpetas - IDs de carpetas en Drive.
 * @property {Set<string>} archivos - IDs de archivos en Drive.
 */

/** @type {RastreoTest} */
const REGISTRO_PRUEBAS = crearRastreoTest();

/**
 * Inicializa y define las suites de pruebas unitarias.
 */
function definirPruebasUnitarias() {
  const Qunit = QUnitGS2.QUnit;

  PU_BaseDatos();
  PU_ReglasNegocio();
  PU_Utils();
  PU_Main();
  PU_LogicaNegocio();
  PU_Admin(REGISTRO_PRUEBAS);
  PU_Revisiones(REGISTRO_PRUEBAS);
  PU_Drive(REGISTRO_PRUEBAS);
  PU_User(REGISTRO_PRUEBAS);
  PU_Versiones(REGISTRO_PRUEBAS);
  PU_Documentos(REGISTRO_PRUEBAS);

  Qunit.done(() => {
    console.log("=== CLEANUP GLOBAL FINAL ===");
    cleanupSuite(REGISTRO_PRUEBAS);
  });
}

/**
 * Crea un objeto de rastreo inicializado con Sets vacíos.
 * @return {RastreoTest} Objeto de rastreo estructurado.
 */
function crearRastreoTest() {
  return {
    docs: new Set(),
    versiones: new Set(),
    revisiones: new Set(),
    usuarios: new Set(),
    actividades: new Set(),
    carpetas: new Set(),
    archivos: new Set()
  };
}

/**
 * Registra un email de usuario para limpieza.
 * @param {RastreoTest} rastreo 
 * @param {string} email 
 */
function trackUsuario(rastreo, email) { rastreo.usuarios.add(email); }

/**
 * Registra un ID de documento para limpieza.
 * @param {RastreoTest} rastreo 
 * @param {string} idRaiz 
 */
function trackDoc(rastreo, idRaiz) { rastreo.docs.add(idRaiz); }

/**
 * Registra un ID de versión para limpieza.
 * @param {RastreoTest} rastreo 
 * @param {string} idRaiz 
 */
function trackVersion(rastreo, idRaiz) { rastreo.versiones.add(idRaiz); }

/**
 * Registra un nombre de actividad para limpieza por coincidencia de texto.
 * @param {RastreoTest} rastreo 
 * @param {string} nombreDoc 
 */
function trackActividad(rastreo, nombreDoc) { rastreo.actividades.add(nombreDoc); }

/**
 * Registra un ID de carpeta de Drive para enviar a la papelera.
 * @param {RastreoTest} rastreo 
 * @param {string} folderId 
 */
function trackCarpeta(rastreo, folderId) { rastreo.carpetas.add(folderId); }

/**
 * Registra un ID de archivo de Drive para enviar a la papelera.
 * @param {RastreoTest} rastreo 
 * @param {string} fileId 
 */
function trackArchivo(rastreo, fileId) { rastreo.archivos.add(fileId); }

/**
 * Registra un ID de revisión para limpieza.
 * @param {RastreoTest} rastreo 
 * @param {string} idRevision 
 */
function trackRevision(rastreo, idRevision) { rastreo.revisiones.add(idRevision); }

/**
 * Borra filas de una hoja de cálculo comparando valores en una columna específica.
 * @param {function} getSheet - Función que retorna la instancia de la hoja.
 * @param {Set<string>} idsSet - Conjunto de IDs a buscar.
 * @param {number} colIndex - Índice de la columna (0-based).
 */
function limpiarPorIds(getSheet, idsSet, colIndex) {
  const ids = [...idsSet];
  if (!ids.length) return;

  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = data.length - 1; i >= 1; i--) {
    if (ids.includes(data[i][colIndex])) {
      sheet.deleteRow(i + 1);
    }
  }
}

/**
 * Limpia los registros de la hoja de actividades.
 * @param {RastreoTest} rastreo 
 */
function limpiarActividad(rastreo) {
  const actividades = [...rastreo.actividades];
  if (!actividades.length) return;

  const sheet = getSheet_ACT();
  const data = sheet.getDataRange().getValues();

  for (let i = data.length - 1; i >= 1; i--) {
    const titulo = data[i][2];
    const eliminar = actividades.some(nombre => titulo && titulo.toString() === nombre);
    if (eliminar) sheet.deleteRow(i + 1);
  }
}

/**
 * Ejecuta el proceso de limpieza global de Google Sheets y Google Drive.
 * @param {RastreoTest} rastreo 
 */
function cleanupSuite(rastreo) {
  SpreadsheetApp.flush();
  Utilities.sleep(500);
  
  console.log("--- INICIANDO CLEANUP GLOBAL ---");

  const configuracionLimpieza = [
    { fn: getSheet_DOC, data: rastreo.docs, col: 2, label: "DOC" },
    { fn: getSheet_VER, data: rastreo.versiones, col: 0, label: "VER" },
    { fn: getSheet_USR, data: rastreo.usuarios, col: 0, label: "USR" },
    { fn: getSheet_REV, data: rastreo.revisiones, col: 1, label: "REV" }
  ];

  configuracionLimpieza.forEach(conf => {
    try {
      limpiarPorIds(conf.fn, conf.data, conf.col);
    } catch (e) {
      console.error(`Error limpiando ${conf.label}:`, e);
    }
  });

  try {
    limpiarActividad(rastreo);
  } catch (e) {
    console.error("Error limpiando ACT:", e);
  }

  rastreo.carpetas.forEach(id => {
    try { DriveApp.getFolderById(id).setTrashed(true); } 
    catch (e) { console.error(`Error limpiando carpeta ${id}:`, e); }
  });

  rastreo.archivos.forEach(id => {
    try { DriveApp.getFileById(id).setTrashed(true); } 
    catch (e) { console.error(`Error limpiando archivo ${id}:`, e); }
  });
  
  console.log("--- CLEANUP FINALIZADO ---");
}