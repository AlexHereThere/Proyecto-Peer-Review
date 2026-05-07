/**
 * @fileoverview Revision.gs - Orquestador optimizado del proceso de revisión.
 * Gestiona la asignación, estados y persistencia de revisiones de documentos en Drive y Sheets.
 */

// ==========================================
// 1. FUNCIONES DE NEGOCIO (ORQUESTADORES)
// ==========================================

/**
 * Crea la revisión formalmente. Centraliza la lógica de copia y permisos.
 * Puede ser llamada por el Autor o automáticamente por el sistema.
 * @param {string} idArchivoV - ID del archivo de la versión de origen.
 * @param {string} emailRevisor - Correo electrónico del revisor asignado.
 * @param {string} folderRevId - ID de la carpeta de Drive donde se guardará la revisión.
 * @returns {Object} Objeto con el estado de éxito y el ID de la nueva revisión.
 */
function asignarRevision(idArchivoV, emailRevisor, folderRevId) {
  const archivoVersion = DriveApp.getFileById(idArchivoV);
  const nombreDoc = archivoVersion.getName();
  const idArchivoV1 = obtenerIdRaizDesdeVersion(idArchivoV);
  const proximaRevNum = calcularSiguienteCorrelativo(folderRevId, nombreDoc);
  const nombreRevision = `R${proximaRevNum}_${nombreDoc}`;
  const revisionId = copiarArchivo(idArchivoV, nombreRevision, folderRevId);
  compartirSinNotificacion(revisionId, emailRevisor);
  db_registrarRevision(idArchivoV, revisionId, proximaRevNum, emailRevisor);
  registrarActividad(nombreDoc, "ReviewerAssigned", "Se asignó revisor a " + nombreDoc, "bg-warning text-dark", `abrirDocumento('${idArchivoV1}')`);
  return { success: true, idR: revisionId };
}

/**
 * Otorga permisos de edición a un usuario en un archivo de Drive sin enviar notificación por email.
 * @param {string} fileId - ID del archivo a compartir.
 * @param {string} emailRevisor - Correo electrónico del usuario.
 * @returns {boolean} True si la operación fue exitosa.
 * @throws {Error} Si ocurre un error al interactuar con el API de Drive.
 */
function compartirSinNotificacion(fileId, emailRevisor) {
  try {
    Drive.Permissions.create(
      {
        role: "writer",
        type: "user",
        emailAddress: emailRevisor
      },
      fileId,
      { sendNotificationEmail: false }
    );
    return true;
  } catch (e) {
    console.error("Error al compartir sin notificación: " + e);
    throw e;
  }
}

/**
 * Inicia el proceso de revisión de un archivo, cambiando su estado de "Nuevo" a "En revisión".
 * @param {string} idArchivoR - ID del archivo de revisión (columna B de la BD).
 * @returns {boolean} False si la revisión no existe o no tiene el estado inicial correcto.
 */
function iniciarRevision(idArchivoR) {
  const sheet = getSheet_REV();
  const data = sheet.getDataRange().getValues();
  const filaIndex = data.findIndex(row => row[1] === idArchivoR);
  if (filaIndex <= 0) return false;
  const row = data[filaIndex];
  const estadoActual = row[4];
  if (estadoActual !== "Nuevo") return false;
  const idArchivoV = row[0];
  const idArchivoV1 = obtenerIdRaizDesdeVersion(idArchivoV);
  const archivo = DriveApp.getFileById(idArchivoR);
  const nombreDoc = archivo.getName();
  db_actualizarEstadoRevision(idArchivoR, "En revisión");
  registrarActividad(nombreDoc, "ReviewStarted", `${nombreDoc} en revisión`, "bg-warning text-dark", `abrirDocumento('${idArchivoV1}')`);
  return true;
}

/**
 * Finaliza la revisión de un archivo y actualiza el log de actividades.
 * @param {string} fileId - ID del archivo de revisión finalizado.
 * @returns {boolean} True si la operación fue exitosa.
 */
function finalizarRevision(idArchivoR) {
  const sheet = getSheet_REV();
  const data = sheet.getDataRange().getValues();
  const filaIndex = data.findIndex(row => row[1] === idArchivoR);
  if (filaIndex <= 0) return false;
  const row = data[filaIndex];
  const idArchivoV = row[0];
  const idArchivoV1 = obtenerIdRaizDesdeVersion(idArchivoV);
  const archivo = DriveApp.getFileById(idArchivoR);
  const nombreDoc = archivo.getName();
  db_actualizarEstadoRevision(idArchivoR, "Finalizado");
  registrarActividad(nombreDoc, "ReviewSubmitted", `Revisión finalizada de ${nombreDoc}`, "bg-success text-white", `abrirDocumento('${idArchivoV1}')`);
  return true;
}

/**
 * Prepara el contenido binario del PDF para el visor. Si no existe una revisión previa, la crea.
 * @param {string} fileIdVersion - ID de la versión de origen.
 * @param {string} folderRevId - ID de la carpeta de revisiones.
 * @returns {Object} Datos del archivo PDF consumibles por el cliente.
 */
function prepararPDFParaRevisor(fileIdVersion, folderRevId) {
  const email = Session.getActiveUser().getEmail();
  const registro = buscarRevisionExistente(fileIdVersion, email);
  if (registro) {
    return getPDFData(registro[1]);
  }
  const nuevaRev = asignarRevision(fileIdVersion, email, folderRevId);
  return getPDFData(nuevaRev.idR);
}

/**
 * Sube un nuevo archivo físico como revisión y registra la relación en la base de datos.
 * @param {string} idArchivoV - ID de la versión padre.
 * @param {number} numRevision - Número de revisión asignado.
 * @param {string} nombreRevision - Nombre base del archivo.
 * @param {string} base64 - Contenido del archivo en base64.
 * @param {string} emailRevisor - Correo del revisor que sube el archivo.
 * @returns {string} ID del nuevo archivo creado en Drive.
 */
function orquestarNuevaRevision(idArchivoV, numRevision, nombreRevision, base64, emailRevisor) {
  const folderId = obtenerFolderRevisionesDesdeVersion(idArchivoV);
  const nombreFinal = `R${numRevision}_${nombreRevision}`;
  const idArchivoR = subirArchivo(nombreFinal, base64, folderId);
  db_registrarRevision(idArchivoV, idArchivoR, numRevision, emailRevisor);
  return idArchivoR;
}

/**
 * Sobrescribe el contenido de un archivo PDF con nuevos comentarios.
 * @param {string} base64Data - Nuevo contenido del PDF en base64.
 * @param {string} fileId - ID del archivo de revisión a actualizar.
 * @returns {boolean} True si el guardado fue exitoso.
 * @throws {Error} Si la revisión ya está finalizada o no se encuentra.
 */
function guardarComentarios(base64Data, fileId) {
  try {
    const registro = getSheet_REV().getDataRange().getValues().find(row => row[1] === fileId);
    if (!registro) throw new Error("Revisión no encontrada");
    const estado = registro[4];
    if (estado === "Finalizado") {
      throw new Error("No se puede editar una revisión finalizada");
    }
    actualizarContenidoArchivo(fileId, base64Data);
    const archivo = DriveApp.getFileById(fileId);
    const nombreDoc = archivo.getName();
    const idArchivoV = registro[0];
    const idArchivoV1 = obtenerIdRaizDesdeVersion(idArchivoV);
    registrarActividad(nombreDoc, "DraftSaved", `Nuevos comentarios en ${nombreDoc}`, "bg-warning text-dark", `abrirDocumento('${idArchivoV1}')`);
    return true;
  } catch (e) {
    console.error(e);
    throw e;
  }
}

// ==========================================
// CONSULTAS Y PERSISTENCIA (DB)
// ==========================================

/**
 * Inserta una nueva fila de registro en la hoja de cálculo de Revisiones.
 * @param {string} idV - ID de la versión vinculada.
 * @param {string} idR - ID de la revisión creada.
 * @param {number} num - Número correlativo de la revisión.
 * @param {string} email - Correo electrónico del revisor.
 * @param {string} [estado="Nuevo"] - Estado inicial de la revisión.
 */
function db_registrarRevision(idV, idR, num, email, estado = "Nuevo") {
  const sheet = getSheet_REV();
  sheet.appendRow([idV, idR, num, email, estado, new Date()]);
}

/**
 * Actualiza la columna de estado para una revisión específica en Google Sheets.
 * @param {string} idArchivoR - ID del archivo de revisión a buscar (Columna B).
 * @param {string} nuevoEstado - Nuevo valor de estado.
 * @returns {boolean} True si se encontró y actualizó la fila.
 */
function db_actualizarEstadoRevision(idArchivoR, nuevoEstado) {
  const sheet = getSheet_REV();
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === idArchivoR) {
      sheet.getRange(i + 1, 5).setValue(nuevoEstado);
      return true;
    }
  }
  return false;
}

/**
 * Obtiene la lista de revisiones asignadas al usuario en sesión, cruzando nombres de versiones.
 * @returns {Array<Object>} Lista de objetos con datos formateados de la revisión.
 */
function obtenerRevisiones_Usuario() {
  const sheetRev = getSheet_REV();
  const sheetVer = getSheet_VER();
  if (!sheetRev || !sheetVer) return [];
  const email = Session.getActiveUser().getEmail();
  const dataRev = sheetRev.getDataRange().getValues();
  const dataVer = sheetVer.getDataRange().getValues();
  const nombresVersiones = {};
  dataVer.slice(1).forEach(fila => {
    nombresVersiones[fila[1]] = fila[3];
  });
  return dataRev.slice(1)
    .filter(row => row[3] === email)
    .map(row => {
      const idVersion = row[0];
      return {
        idVersionPadre: idVersion,
        idArchivoRev: row[1],
        numRev: row[2],
        nombreDoc: nombresVersiones[idVersion] || "Documento sin nombre",
        estado: row[4],
        fecha: row[5] ? Utilities.formatDate(new Date(row[5]), Session.getScriptTimeZone(), "dd/MM/yyyy") : "Sin fecha"
      };
    });
}

/**
 * Busca si ya existe un registro de revisión para una versión y usuario específicos.
 * @param {string} idArchivoV - ID de la versión.
 * @param {string} email - Correo del usuario.
 * @returns {Array|undefined} La fila encontrada o undefined.
 */
function buscarRevisionExistente(idArchivoV, email) {
  const data = getSheet_REV().getDataRange().getValues();
  return data.slice(1).find(fila => fila[0] == idArchivoV && fila[3] == email);
}

// ==========================================
// UTILIDADES
// ==========================================

/**
 * Calcula el siguiente número correlativo (R) para un documento basándose en archivos existentes.
 * @param {string} folderId - ID de la carpeta donde se auditan los archivos.
 * @param {string} nombreDoc - Nombre del documento (debe contener el prefijo de versión).
 * @returns {number} Siguiente número de revisión.
 * @throws {Error} Si el nombre del documento no contiene un prefijo de versión válido (Vn_).
 */
function calcularSiguienteCorrelativo(folderId, nombreDoc) {
  const versionMatch = nombreDoc.match(/^V(\d+)_/);
  if (!versionMatch) throw new Error("Nombre sin versión válida");
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles();
  const regex = /^R(\d+)_V(\d+)_/;
  let maxRPorVersion = {};
  while (files.hasNext()) {
    const name = files.next().getName();
    const match = name.match(regex);
    if (match) {
      const r = parseInt(match[1], 10);
      const v = match[2];
      if (!maxRPorVersion[v]) maxRPorVersion[v] = 0;
      if (r > maxRPorVersion[v]) maxRPorVersion[v] = r;
    }
  }
  const version = versionMatch[1];
  return (maxRPorVersion[version] || 0) + 1;
}

/**
 * Recupera el estado actual de una revisión desde la base de datos.
 * @param {string} idArchivoR - ID de la revisión.
 * @returns {string|null} El estado encontrado o null.
 */
function obtenerEstadoRevision(idArchivoR) {
  const data = getSheet_REV().getDataRange().getValues();
  const fila = data.find(row => row[1] === idArchivoR);
  return fila ? fila[4] : null;
}