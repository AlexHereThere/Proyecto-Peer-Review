/**
 * Admin.js - Funciones de administración y gestión de revisores.
 */

/**
 * Obtiene la lista de usuarios con el rol de "Revisor".
 * @returns {Array<Object>} Lista de objetos con email y nombre de los revisores.
 */
function obtenerRevisoresDelSistema() {
  const data = getSheetData("Usuarios");
  return data.slice(1)
    .filter(row => {
      const roles = row[2] ? row[2].toString().split(",").map(r => r.trim()) : [];
      return roles.includes("Revisor");
    })
    .map(row => ({
      email:  row[0],
      nombre: row[1]
    }));
}

/**
 * Obtiene el valor de la configuración "CopiarRevisores" para un documento específico.
 * @param {string} idDocumento - El ID del documento raíz.
 * @returns {boolean} El valor de la configuración o false si no existe.
 */
function getCopiarRevisores(idDocumento) {
  const fila = findRowInSheet("Configuracion", 0, idDocumento);
  return fila ? fila[1] : false;
}

/**
 * Establece el valor de la configuración "CopiarRevisores" para un documento específico.
 * @param {string} idDocumento - El ID del documento raíz.
 * @param {boolean} valor - El valor a establecer.
 */
function setCopiarRevisores(idDocumento, valor) {
  const ss = getSpreed();
  const sheet = ss.getSheetByName("Configuracion");
  const data  = getSheetData("Configuracion");
  const idx  = data.findIndex(row => row[0] === idDocumento);
  if (idx >= 0) {
    sheet.getRange(idx + 1, 2).setValue(valor);
  } else {
    sheet.appendRow([idDocumento, valor]);
  }
}

/**
 * Asigna un revisor a un documento desde la interfaz de administración.
 * @param {string} idRaiz - El ID del documento raíz.
 * @param {string} emailRevisor - El correo electrónico del revisor.
 * @param {string} folderRevId - El ID de la carpeta de revisiones.
 * @param {string} [tipoRevision] - El tipo de revisión (por defecto "Doble Ciego").
 * @returns {Object} El resultado de la asignación.
 * @throws {Error} Si no se encuentran versiones o si el revisor ya está asignado.
 */
function asignarRevisorDesdeAdmin(idRaiz, emailRevisor, folderRevId, tipoRevision) {
  const tipo = tipoRevision || "Doble Ciego";

  const dataVer = getSheetData("Versiones");
  const versiones = dataVer.slice(1).filter(row => row[0] === idRaiz).sort((a, b) => b[2] - a[2]);

  if (versiones.length === 0) throw new Error("No se encontraron versiones para este documento.");
  const idArchivoV = versiones[0][1];

  const yaAsignado = buscarRevisionExistente(idArchivoV, emailRevisor);
  if (yaAsignado) throw new Error("Este revisor ya está asignado a este documento.");

  const resultado = asignarRevision(idArchivoV, emailRevisor, folderRevId, tipo);

  const filaDoc = findRowInSheet("Documentos", 2, idRaiz);
  const nombreDoc = filaDoc ? filaDoc[1] : "un documento";

  enviarNotificacion_AsignacionNueva(emailRevisor, nombreDoc, resultado.idR);
  ejecutarActualizacionDeEstadoMaestro(idRaiz);

  return resultado;
}

/**
 * Copia los revisores de la primera versión a la versión actual de un documento.
 * @param {string} idRaiz - El ID del documento raíz.
 * @param {string} folderRevId - El ID de la carpeta de revisiones.
 * @returns {Object} Objeto con un mensaje descriptivo del resultado.
 */
function copiarRevisoresV1AVersionActual(idRaiz, folderRevId) {
  const dataVer = getSheetData("Versiones");
  const versiones = dataVer.slice(1).filter(row => row[0] === idRaiz).sort((a, b) => a[2] - b[2]);

  if (versiones.length === 0) return { mensaje: "No hay versiones." };
  if (versiones.length === 1) return { mensaje: "Solo hay una versión, no hay nada que copiar." };

  const idArchivoV1 = versiones[0][1];

  const datosRevisionesV1 = getSheetData("Revisiones").slice(1)
    .filter(row => row[0] === idArchivoV1)
    .map(row => ({
      email: row[3],
      tipoRevision: row[6] || "Doble Ciego"
    }));

  if (datosRevisionesV1.length === 0) return { mensaje: "V1 no tiene revisores asignados." };

  const versionActual = versiones[versiones.length - 1];
  const idArchivoVActual = versionActual[1];
  const filaDoc = findRowInSheet("Documentos", 2, idRaiz);
  const nombreDoc = filaDoc ? filaDoc[1] : "un documento";

  let copiados = 0; let existentes = 0;

  datosRevisionesV1.forEach(rev => {
    try {
      if (buscarRevisionExistente(idArchivoVActual, rev.email)) { existentes++; return; }

      const resultado = asignarRevision(idArchivoVActual, rev.email, folderRevId, rev.tipoRevision);
      enviarNotificacion_NuevaVersion(rev.email, nombreDoc, versionActual[2], resultado.idR);
      copiados++;
    } catch(e) { console.warn("No se pudo copiar revisor: " + rev.email); }
  });

  ejecutarActualizacionDeEstadoMaestro(idRaiz);
  return { mensaje: `${copiados} revisor(es) copiados. ${existentes} ya asignados.` };
}

/**
 * Elimina un revisor de una versión específica.
 * @param {string} idArchivoR - El ID del archivo de la revisión.
 * @returns {boolean} True si la eliminación fue exitosa.
 * @throws {Error} Si la revisión no se encuentra.
 */
function quitarRevisorDeVersion(idArchivoR) {
  const ss = getSpreed();
  const sheetRev = ss.getSheetByName("Revisiones");
  const dataRev = getSheetData("Revisiones");
  const filaIndex = dataRev.findIndex(row => row[1] === idArchivoR);
  if (filaIndex <= 0) throw new Error("Revisión no encontrada.");

  const row = dataRev[filaIndex];
  const idRaiz = obtenerIdRaizDesdeVersion(row[0]);

  try {
    Drive.Permissions.list(idArchivoR).items.forEach(p => { if (p.role !== "owner") Drive.Permissions.remove(idArchivoR, p.id); });
  } catch(e) { console.warn("No se revocó en Drive: " + e.message); }

  sheetRev.deleteRow(filaIndex + 1);

  try { DriveApp.getFileById(idArchivoR).setTrashed(true); } catch(e) { console.warn("No se borró archivo."); }

  ejecutarActualizacionDeEstadoMaestro(idRaiz);
  return true;
}