/**
 * Revisiones.js - Orquestador centralizado del proceso de revisión.
 * Gestiona la asignación, estados, flujos de correo y persistencia relacional
 * sincronizando en tiempo real el estado maestro en la tabla 'Documentos'.
 */

// ==========================================
// 1. FUNCIONES DE NEGOCIO (ORQUESTADORES)
// ==========================================

/**
 * Crea la revisión formalmente. Centraliza la lógica de copia y permisos.
 * @param {string} idArchivoV - ID del archivo de la versión a revisar.
 * @param {string} emailRevisor - Correo electrónico del revisor asignado.
 * @param {string} folderRevId - ID de la carpeta donde se guardará el archivo de revisión.
 * @param {string} [tipoRevision] - Tipo de revisión (Abierta, Simple Ciego, Doble Ciego).
 * @returns {Object} Objeto con el estado del éxito y el ID del archivo de revisión.
 */
function asignarRevision(idArchivoV, emailRevisor, folderRevId, tipoRevision) {
  const archivoVersion = DriveApp.getFileById(idArchivoV);
  const nombreDoc = archivoVersion.getName();
  const idArchivoV1 = obtenerIdRaizDesdeVersion(idArchivoV);
  const proximaRevNum = calcularSiguienteCorrelativo(folderRevId, nombreDoc);
  const nombreRevision = `R${proximaRevNum}_${nombreDoc}`;
  const revisionId = copiarArchivo(idArchivoV, nombreRevision, folderRevId);
  
  const tipo = tipoRevision || "Doble Ciego";
  compartirSinNotificacion(revisionId, emailRevisor);
  
  db_registrarRevision(idArchivoV, revisionId, proximaRevNum, emailRevisor, "Pendiente", tipo);
  
  // OBTENER DUEÑO: Optimizado con findRowInSheet
  const filaDoc = findRowInSheet("Documentos", 2, idArchivoV1);
  const emailDueno = filaDoc ? filaDoc[7] : Session.getActiveUser().getEmail();
  const tituloDocumento = filaDoc ? filaDoc[1] : nombreDoc;

  // Registro de actividad
  registrarActividad(
    emailDueno, 
    tituloDocumento, 
    "ReviewerAssigned", 
    `Se asignó revisor para el documento.`, 
    "bg-warning text-dark", 
    `abrirDocumento('${idArchivoV1}')`
  );
  
  ejecutarActualizacionDeEstadoMaestro(idArchivoV1);
  return { success: true, idR: revisionId };
}

/**
 * Inicia el proceso de revisión de un archivo, cambiando su estado de "Asignado" a "En Revisión".
 * @param {string} idArchivoR - ID del archivo de la revisión.
 * @returns {boolean} True si el estado se actualizó correctamente, false en caso contrario.
 */
function iniciarRevision(idArchivoR) {
  const data = getSheetData("Revisiones");
  const filaIndex = data.findIndex(row => row[1] === idArchivoR);
  if (filaIndex <= 0) return false;
  
  const row = data[filaIndex];
  const estadoActual = row[4];
  
  if (estadoActual !== "Asignado" && estadoActual !== "Pendiente") return false;
  
  const idArchivoV = row[0];
  const idArchivoV1 = obtenerIdRaizDesdeVersion(idArchivoV);
  
  db_actualizarEstadoRevision(idArchivoR, "En Revisión");

  const filaDoc = findRowInSheet("Documentos", 2, idArchivoV1);
  const emailDueno = filaDoc ? filaDoc[7] : Session.getActiveUser().getEmail();
  const tituloDocumento = filaDoc ? filaDoc[1] : "Documento en Revisión";
  
  // Registro de actividad
  registrarActividad(
    emailDueno, 
    tituloDocumento, 
    "ReviewStarted", 
    "El revisor ha comenzado la evaluación del documento.", 
    "bg-warning text-dark", 
    `abrirDocumento('${idArchivoV1}')`
  );
  
  SpreadsheetApp.flush(); //escibe fila
  limpiarCacheDatos(); //borrar caché

  ejecutarActualizacionDeEstadoMaestro(idArchivoV1);
  return true;
}

/**
 * Finaliza la revisión de un archivo y actualiza el log de actividades de forma síncrona.
 * @param {string} idArchivoR - ID del archivo de la revisión.
 * @param {string} dictamenRevisor - El resultado de la revisión ("A Corregir" o "Aprobado").
 * @returns {boolean} True si el proceso finaliza correctamente.
 */
function finalizarRevision(idArchivoR, dictamenRevisor) {
  const data = getSheetData("Revisiones");
  const filaIndex = data.findIndex(row => row[1] === idArchivoR);
  if (filaIndex <= 0) return false;
  
  const row = data[filaIndex];
  const idArchivoV = row[0];
  const idArchivoV1 = obtenerIdRaizDesdeVersion(idArchivoV);
  
  const estadoDestino = (dictamenRevisor === "A Corregir" || dictamenRevisor === "Aprobado") ? dictamenRevisor : "Aprobado";
  
  db_actualizarEstadoRevision(idArchivoR, estadoDestino);

  const filaDoc = findRowInSheet("Documentos", 2, idArchivoV1);
  const emailDueno = filaDoc ? filaDoc[7] : Session.getActiveUser().getEmail();
  const tituloDocumento = filaDoc ? filaDoc[1] : "Documento Finalizado";

  // Registro de actividad
  registrarActividad(
    emailDueno, 
    tituloDocumento, 
    "ReviewSubmitted", 
    `Revisión finalizada con dictamen: ${estadoDestino}.`, 
    "bg-success text-white", 
    `abrirDocumento('${idArchivoV1}')`
  );
  
  SpreadsheetApp.flush(); //escibe fila
  limpiarCacheDatos(); //borrar caché

  ejecutarActualizacionDeEstadoMaestro(idArchivoV1);
  return true;
}

// ==========================================
// INTERCEPTOR Y CONTROLADOR DE ESTADOS
// ==========================================

/**
 * Cambia el estado de una revisión manejando flujos especiales como rechazos o inicios.
 * @param {string} idArchivoR - ID del archivo de la revisión.
 * @param {string} nuevoEstado - El nuevo estado solicitado.
 * @returns {boolean} Resultado de la operación.
 */
function cambiarEstadoRevision(idArchivoR, nuevoEstado) {
  const email = Session.getActiveUser().getEmail();
  let idArchivoV = null;

  const dataRevActual = getSheetData("Revisiones");
  const filaActual = dataRevActual.find(row => row[1] === idArchivoR);
  if (!filaActual) return false;
  
  const estadoRealEnBD = filaActual[4];
  idArchivoV = filaActual[0];

  if (estadoRealEnBD === "Aprobado" || estadoRealEnBD === "A Corregir") {
    console.warn(`Intento de mutación denegado. El registro ya se encuentra concluido como: ${estadoRealEnBD}`);
    return false;
  }

  if (nuevoEstado === "Rechazado") { 
    nuevoEstado = "Pendiente"; 
    
    const filaVer = findRowInSheet("Versiones", 1, idArchivoV);
    const nombreDoc = filaVer ? filaVer[3] : "un documento";
    
    quitarRevisorDeVersion(idArchivoR);
    enviarNotificacion_RevisionRechazada(email, nombreDoc);
    return true; 
  }

  if (nuevoEstado === "En Revisión") {
    return iniciarRevision(idArchivoR); 
  }

  const result = db_actualizarEstadoRevision(idArchivoR, nuevoEstado);

  try {
    if (idArchivoV) {
      const idRaiz = obtenerIdRaizDesdeVersion(idArchivoV);
      ejecutarActualizacionDeEstadoMaestro(idRaiz);
    }
  } catch(e) {
    console.error("Error en propagación de estado maestro: " + e.toString());
  }

  return result;
}

// ==========================================
// CONSULTAS Y PERSISTENCIA (DB)
// ==========================================

/**
 * Registra una nueva fila en la hoja de 'Revisiones'.
 * @param {string} idV - ID de la versión asociada.
 * @param {string} idR - ID del archivo de la revisión.
 * @param {number} num - Número correlativo de revisión.
 * @param {string} email - Correo del revisor.
 * @param {string} estado - Estado inicial.
 * @param {string} tipoRevision - Tipo de revisión asignado.
 */
function db_registrarRevision(idV, idR, num, email, estado, tipoRevision) {
  const ss = getSpreed();
  const sheet = ss.getSheetByName("Revisiones");
  sheet.appendRow([idV, idR, num, email, estado, new Date(), tipoRevision]);
}

/**
 * Actualiza el campo estado de una revisión en la hoja de cálculo.
 * @param {string} idArchivoR - ID del archivo de revisión.
 * @param {string} nuevoEstado - El nuevo valor del estado.
 * @returns {boolean} True si se encontró y actualizó el registro.
 */
function db_actualizarEstadoRevision(idArchivoR, nuevoEstado) {
  const ss = getSpreed();
  const sheet = ss.getSheetByName("Revisiones");
  const data = getSheetData("Revisiones");
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === idArchivoR) {
      sheet.getRange(i + 1, 5).setValue(nuevoEstado);
      return true;
    }
  }
  return false;
}

/**
 * Obtiene las revisiones asignadas al usuario activo aplicando anonimato sobre el autor.
 * @returns {Array<Object>} Lista de revisiones asignadas al usuario.
 */
function obtenerRevisiones_Usuario() {
  const dataRev = getSheetData("Revisiones");
  const dataVer = getSheetData("Versiones");
  const dataDoc = getSheetData("Documentos");
  
  const emailLogueado = Session.getActiveUser().getEmail();
  const rolUsuarioActual = "Revisor"; 

  const mapeoVersiones = {};
  dataVer.slice(1).forEach(fila => {
    mapeoVersiones[fila[1]] = { idRaiz: fila[0], nombre: fila[3] };
  });

  const mapeoAutores = {};
  dataDoc.slice(1).forEach(fila => {
    mapeoAutores[fila[2]] = fila[7]; 
  });

  return dataRev.slice(1)
    .filter(row => row[3] === emailLogueado)
    .map(row => {
      const vInfo = mapeoVersiones[row[0]] || { idRaiz: "", nombre: "Documento sin nombre" };
      const emailAutorOriginal = mapeoAutores[vInfo.idRaiz] || "";
      const tipoRevisionOriginal = row[6] || "Doble Ciego";

      const identidades = obtenerIdentidadesVisibles(tipoRevisionOriginal, emailAutorOriginal, emailLogueado, rolUsuarioActual);

      return ({
        idVersionPadre: row[0],
        idArchivoRev:   row[1],
        numRev:          row[2],
        nombreDoc:      vInfo.nombre,
        estado:         row[4],
        autor:          identidades.autor, 
        tipoRevision:   tipoRevisionOriginal,
        fecha:          row[5] ? Utilities.formatDate(new Date(row[5]), Session.getScriptTimeZone(), "dd/MM/yyyy") : "Sin fecha"
      });
    });
}

/**
 * Obtiene todas las revisiones de un documento específico para su visualización.
 * @param {string} idRaiz - ID del documento raíz.
 * @returns {Array<Object>} Lista de revisiones filtradas y sanitizadas.
 */
function obtenerRevisionesDeDocumento(idRaiz) {
  const emailLogueado = Session.getActiveUser().getEmail();
  const rolUsuarioActual = determinarRolDeUsuarioEnDocumento(idRaiz, emailLogueado); 
  
  const filaDoc = findRowInSheet("Documentos", 2, idRaiz);
  const emailAutorOriginal = filaDoc ? filaDoc[7] : "";

  const idsVersiones = filterRowsInSheet("Versiones", 0, idRaiz).map(row => row[1]);
  
  return getSheetData("Revisiones").slice(1)
    .filter(row => idsVersiones.includes(row[0]))
    .map(row => {
      const emailRevisorOriginal = row[3];
      const tipoRevisionOriginal = row[6] || "Doble Ciego";

      const identidades = obtenerIdentidadesVisibles(tipoRevisionOriginal, emailAutorOriginal, emailRevisorOriginal, rolUsuarioActual);

      return {
        emailRevisor: identidades.revisor, 
        estado:       row[4],
        tipoRevision: tipoRevisionOriginal,
        fecha:        row[5] ? Utilities.formatDate(new Date(row[5]), Session.getScriptTimeZone(), "dd/MM/yyyy") : "Sin fecha"
      };
    });
}

/**
 * Obtiene las revisiones agrupadas por versión para un documento raíz.
 * @param {string} idRaiz - ID del documento raíz.
 * @returns {Object} Estructura con versiones, sus revisores y configuración.
 */
function obtenerRevisionesDeDocumentoPorVersion(idRaiz) {
  const dataVer = getSheetData("Versiones");
  const dataRev = getSheetData("Revisiones");

  const versiones = dataVer.slice(1).filter(row => row[0] === idRaiz).sort((a, b) => a[2] - b[2])
    .map(ver => {
      const revisores = dataRev.slice(1).filter(rev => rev[0] === ver[1])
        .map(rev => ({ 
          emailRevisor: rev[3], 
          estado: rev[4], 
          idArchivoR: rev[1],
          tipoRevision: rev[6] || "Doble Ciego" 
        }));
      return { numero: ver[2], idArchivoV: ver[1], nombre: ver[3], revisores: revisores };
    });

  return { versiones: versiones };
}

/**
 * Busca si ya existe una revisión asignada para un revisor en una versión.
 * @param {string} idArchivoV - ID de la versión.
 * @param {string} email - Correo del revisor.
 * @returns {Array|undefined} La fila de la revisión si existe.
 */
function buscarRevisionExistente(idArchivoV, email) {
  return getSheetData("Revisiones").slice(1).find(fila => fila[0] == idArchivoV && fila[3] == email);
}

/**
 * Obtiene el estado actual de una revisión.
 * @param {string} idArchivoR - ID del archivo de revisión.
 * @returns {string|null} El estado o null si no se encuentra.
 */
function obtenerEstadoRevision(idArchivoR) {
  const fila = findRowInSheet("Revisiones", 1, idArchivoR);
  return fila ? fila[4] : null;
}

/**
 * Sobrescribe el contenido de un archivo PDF con nuevos comentarios.
 * @param {string} base64Data - El contenido del archivo en base64.
 * @param {string} fileId - ID del archivo de revisión.
 * @returns {boolean} True si se guarda correctamente.
 * @throws {Error} Si la revisión no se encuentra.
 */
function guardarComentarios(base64Data, fileId) {
  try {
    const registro = findRowInSheet("Revisiones", 1, fileId);
    if (!registro) throw new Error("Revisión no encontrada");
    
    const estadoRevision = registro[4]; 
    
    if (estadoRevision === "Aprobado" || estadoRevision === "A Corregir") {
      throw new Error("No se puede editar una revisión finalizada.");
    }

    actualizarContenidoArchivo(fileId, base64Data); 
    
    const idArchivoV = registro[0];
    const idArchivoV1 = obtenerIdRaizDesdeVersion(idArchivoV);

    const filaDoc = findRowInSheet("Documentos", 2, idArchivoV1);
    const emailDueno = filaDoc ? filaDoc[7] : Session.getActiveUser().getEmail();
    const tituloDocumento = filaDoc ? filaDoc[1] : "Documento";

    // Registro de actividad
    registrarActividad(
      emailDueno, 
      tituloDocumento, 
      "DraftSaved", 
      "Se guardaron modificaciones locales en el borrador de comentarios.", 
      "bg-warning text-dark", 
      `abrirDocumento('${idArchivoV1}')`
    );
    return true;
  } catch (e) {
    console.error(e);
    throw e;
  }
}
