/**
 * @fileoverview Revisiones.gs - Orquestador centralizado del proceso de revisión.
 * Gestiona la asignación, estados, flujos de correo y persistencia relacional
 * sincronizando en tiempo real el estado maestro en la tabla 'Documentos'.
 */

// ==========================================
// 1. FUNCIONES DE NEGOCIO (ORQUESTADORES)
// ==========================================

/**
 * Crea la revisión formalmente. Centraliza la lógica de copia y permisos.
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
  
  // OBTENER DUEÑO: Columna 8 -> Índice 7 (Email_Autor) | Columna 2 -> Índice 1 (Titulo_Doc)
  const filaDoc = getSheet_DOC().getDataRange().getValues().find(row => row[2] === idArchivoV1);
  const emailDueno = filaDoc ? filaDoc[7] : Session.getActiveUser().getEmail();
  const tituloDocumento = filaDoc ? filaDoc[1] : nombreDoc;

  // === CORREGIDO: Estructura exacta de 6 parámetros ===
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
 * Otorga permisos de edición a un usuario en un archivo de Drive sin enviar notificación por email.
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
 * Inicia el proceso de revisión de un archivo, cambiando su estado de "Asignado" a "En Revisión".
 */
function iniciarRevision(idArchivoR) {
  const sheet = getSheet_REV();
  const data = sheet.getDataRange().getValues();
  const filaIndex = data.findIndex(row => row[1] === idArchivoR);
  if (filaIndex <= 0) return false;
  
  const row = data[filaIndex];
  const estadoActual = row[4];
  
  if (estadoActual !== "Asignado" && estadoActual !== "Pendiente") return false;
  
  const idArchivoV = row[0];
  const idArchivoV1 = obtenerIdRaizDesdeVersion(idArchivoV);
  
  db_actualizarEstadoRevision(idArchivoR, "En Revisión");

  const filaDoc = getSheet_DOC().getDataRange().getValues().find(row => row[2] === idArchivoV1);
  const emailDueno = filaDoc ? filaDoc[7] : Session.getActiveUser().getEmail();
  const tituloDocumento = filaDoc ? filaDoc[1] : "Documento en Revisión";
  
  // === CORREGIDO: Estructura exacta de 6 parámetros ===
  registrarActividad(
    emailDueno, 
    tituloDocumento, 
    "ReviewStarted", 
    "El revisor ha comenzado la evaluación del documento.", 
    "bg-warning text-dark", 
    `abrirDocumento('${idArchivoV1}')`
  );
  
  ejecutarActualizacionDeEstadoMaestro(idArchivoV1);
  return true;
}

/**
 * Finaliza la revisión de un archivo y actualiza el log de actividades de forma síncrona.
 */
function finalizarRevision(idArchivoR, dictamenRevisor) {
  const sheet = getSheet_REV();
  const data = sheet.getDataRange().getValues();
  const filaIndex = data.findIndex(row => row[1] === idArchivoR);
  if (filaIndex <= 0) return false;
  
  const row = data[filaIndex];
  const idArchivoV = row[0];
  const idArchivoV1 = obtenerIdRaizDesdeVersion(idArchivoV);
  
  const estadoDestino = (dictamenRevisor === "A Corregir" || dictamenRevisor === "Aprobado") ? dictamenRevisor : "Aprobado";
  
  db_actualizarEstadoRevision(idArchivoR, estadoDestino);

  const filaDoc = getSheet_DOC().getDataRange().getValues().find(row => row[2] === idArchivoV1);
  const emailDueno = filaDoc ? filaDoc[7] : Session.getActiveUser().getEmail();
  const tituloDocumento = filaDoc ? filaDoc[1] : "Documento Finalizado";

  // === CORREGIDO: Estructura exacta de 6 parámetros ===
  registrarActividad(
    emailDueno, 
    tituloDocumento, 
    "ReviewSubmitted", 
    `Revisión finalizada con dictamen: ${estadoDestino}.`, 
    "bg-success text-white", 
    `abrirDocumento('${idArchivoV1}')`
  );
  
  ejecutarActualizacionDeEstadoMaestro(idArchivoV1);
  return true;
}

// ==========================================
// INTERCEPTOR Y CONTROLADOR DE ESTADOS
// ==========================================

function cambiarEstadoRevision(idArchivoR, nuevoEstado) {
  const email = Session.getActiveUser().getEmail();
  let idArchivoV = null;

  const dataRevActual = getSheet_REV().getDataRange().getValues();
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
    
    const filaVer = getSheet_VER().getDataRange().getValues().find(row => row[1] === idArchivoV);
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

function db_registrarRevision(idV, idR, num, email, estado, tipoRevision) {
  const sheet = getSheet_REV();
  sheet.appendRow([idV, idR, num, email, estado, new Date(), tipoRevision]);
}

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
 * Obtiene las revisiones asignadas al usuario activo aplicando anonimato sobre el autor.
 */
function obtenerRevisiones_Usuario() {
  const sheetRev = getSheet_REV();
  const sheetVer = getSheet_VER();
  const sheetDoc = getSheet_DOC(); 
  if (!sheetRev || !sheetVer || !sheetDoc) return [];
  
  const emailLogueado = Session.getActiveUser().getEmail();
  const rolUsuarioActual = "Revisor"; 

  const dataRev = sheetRev.getDataRange().getValues();
  const dataVer = sheetVer.getDataRange().getValues();
  const dataDoc = sheetDoc.getDataRange().getValues();

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
 * Usado por Autores o Revisores en vistas generales de un documento.
 */
function obtenerRevisionesDeDocumento(idRaiz) {
  const emailLogueado = Session.getActiveUser().getEmail();
  const rolUsuarioActual = determinarRolDeUsuarioEnDocumento(idRaiz, emailLogueado); 
  
  // === CORREGIDO: Índice cambiado a 7 (Email_Autor) ===
  const filaDoc = getSheet_DOC().getDataRange().getValues().find(row => row[2] === idRaiz);
  const emailAutorOriginal = filaDoc ? filaDoc[7] : "";

  const idsVersiones = getSheet_VER().getDataRange().getValues().slice(1).filter(row => row[0] === idRaiz).map(row => row[1]);
  
  return getSheet_REV().getDataRange().getValues().slice(1)
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

function obtenerRevisionesDeDocumentoPorVersion(idRaiz) {
  const dataVer = getSheet_VER().getDataRange().getValues();
  const dataRev = getSheet_REV().getDataRange().getValues();

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

  return { versiones: versiones, copiarRevisores: getCopiarRevisores(idRaiz) };
}

function buscarRevisionExistente(idArchivoV, email) {
  return getSheet_REV().getDataRange().getValues().slice(1).find(fila => fila[0] == idArchivoV && fila[3] == email);
}

function obtenerEstadoRevision(idArchivoR) {
  const fila = getSheet_REV().getDataRange().getValues().find(row => row[1] === idArchivoR);
  return fila ? fila[4] : null;
}

/**
 * Sobrescribe el contenido de un archivo PDF con nuevos comentarios.
 */
function guardarComentarios(base64Data, fileId) {
  try {
    const registro = getSheet_REV().getDataRange().getValues().find(row => row[1] === fileId);
    if (!registro) throw new Error("Revisión no encontrada");
    actualizarContenidoArchivo(fileId, base64Data);
    
    const idArchivoV = registro[0];
    const idArchivoV1 = obtenerIdRaizDesdeVersion(idArchivoV);

    const filaDoc = getSheet_DOC().getDataRange().getValues().find(row => row[2] === idArchivoV1);
    const emailDueno = filaDoc ? filaDoc[7] : Session.getActiveUser().getEmail();
    const tituloDocumento = filaDoc ? filaDoc[1] : "Documento";

    // === CORREGIDO: Estructura exacta de 6 parámetros ===
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

function calcularSiguienteCorrelativo(folderId, nombreDoc) {
  const versionMatch = nombreDoc.match(/^V(\d+)_/);
  if (!versionMatch) throw new Error("Nombre sin versión válida");
  const files = DriveApp.getFolderById(folderId).getFiles();
  let maxRPorVersion = {};
  while (files.hasNext()) {
    const match = files.next().getName().match(/^R(\d+)_V(\d+)_/);
    if (match) {
      const r = parseInt(match[1], 10); 
      const v = match[2];
      if (!maxRPorVersion[v] || r > maxRPorVersion[v]) maxRPorVersion[v] = r;
    }
  }
  return (maxRPorVersion[versionMatch[1]] || 0) + 1;
}

/**
 * Aplica las reglas de anonimato para revisiones (Abierta, Simple Ciego, Doble Ciego).
 */
function obtenerIdentidadesVisibles(tipoRevision, emailAutor, emailRevisor, rolUsuarioActual) {
  const rol = rolUsuarioActual ? rolUsuarioActual.trim().toLowerCase() : "";
  const tipo = tipoRevision ? tipoRevision.trim().toLowerCase() : "";

  if (rol === "admin") {
    return { autor: emailAutor, revisor: emailRevisor };
  }

  let autorVisible = emailAutor;
  let revisorVisible = emailRevisor;

  switch (tipo) {
    case "simple ciego":
      if (rol === "autor") {
        revisorVisible = "Anónimo (Revisor)";
      }
      break;

    case "doble ciego":
      if (rol === "autor") {
        revisorVisible = "Anónimo (Revisor)";
      } else if (rol === "revisor") { 
        autorVisible = "Anónimo (Autor)";
      }
      break;

    case "abierta":
    default:
      break;
  }

  return { autor: autorVisible, revisor: revisorVisible };
}