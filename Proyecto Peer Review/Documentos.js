/**
 * Gestiona el flujo completo de creación de un documento: crea carpetas en Drive, 
 * sube el archivo físico y registra los datos en las tablas relacionales.
 * @param {string} nombreDoc - Nombre del archivo a subir.
 * @param {string} base64 - Contenido del archivo en formato base64.
 * @returns {boolean} True si la operación fue exitosa.
 * @throws {Error} Si el usuario no está registrado en el sistema.
 */
function orquestarSubidaOriginal(nombreDoc, base64) {
  const email = Session.getActiveUser().getEmail();
  const usuario = buscarUsuario(email);
  if (!usuario?.folderId) throw new Error("Usuario no registrado.");
  const nombreLimpio = nombreDoc.replace(/\.[^/.]+$/, "");
  const carpetas = crearCarpetaTrabajo(nombreLimpio, usuario.folderId);
  // Subir el archivo físico (Versión 1)
  const idArchivoV1 = subirArchivo("V1_" + nombreDoc, base64, carpetas.versionesId);
  // Registro relacional
  registrarDocumento(nombreDoc, idArchivoV1, carpetas.trabajoId, carpetas.versionesId, carpetas.revisionesId, "Pendiente", email);
  registrarVersion(idArchivoV1, idArchivoV1, 1, "V1_" + nombreDoc);
  registrarActividad(nombreDoc, "SubmissionCreated", "Subió un nuevo documento.", "text-primary", `abrirDocumento('${idArchivoV1}')`);
  return true;
}

/**
 * Obtiene el historial completo de un documento, cruzando datos de versiones y revisiones
 * para construir un objeto jerárquico consumible por el frontend.
 * @param {string} idRaiz - ID del documento raíz a consultar.
 * @returns {Object|null} Objeto con el árbol de versiones/revisiones o null si no existe.
 */
function obtenerDetalleDocumento(idRaiz) {
  try {
    // Consulta Maestro (Documentos)
    const sheetDoc = getSheet_DOC();
    const dataDoc = sheetDoc.getDataRange().getValues();
    const filaDoc = dataDoc.find(r => r[2] === idRaiz);
    if (!filaDoc) return null;
    // Consulta Relacional (Versiones)
    const sheetVer = getSheet_VER();
    const dataVer = sheetVer.getDataRange().getValues();
    const versionesVinculadas = dataVer.filter(r => r[0] === idRaiz);
    // Consulta Relacional (Revisiones)
    const sheetRev = getSheet_REV();
    const dataRev = sheetRev.getDataRange().getValues();
    const historialVersiones = versionesVinculadas.map(v => {
      const idArchivoV = v[1];
      const revsDeEstaVersion = dataRev.filter(r => r[0] === idArchivoV).map(r => ({
        numero: r[2],
        revisor: r[3],
        estado: r[4],
        fecha: r[5] ? Utilities.formatDate(new Date(r[5]), Session.getScriptTimeZone(), "dd/MM/yyyy") : "-",
        fileId: r[1]
      }));
      return {
        numero: v[2],
        fileId: idArchivoV,
        nombre: v[3],
        revisiones: revsDeEstaVersion
      };
    });
    return {
      nombre: filaDoc[1],
      carpetas: {
        versiones: filaDoc[4],
        revisiones: filaDoc[5]
      },
      versiones: historialVersiones.reverse()
    };
  } catch (e) {
    console.error("Error al obtener detalle: " + e.toString());
    return null;
  }
}

/**
 * Registra el documento maestro en la tabla 'Documentos'.
 * @param {string} nombre - Nombre del archivo.
 * @param {string} fileIdRaiz - ID del archivo físico original (V1).
 * @param {string} trabajoId - ID de la carpeta de trabajo.
 * @param {string} versionesId - ID de la carpeta de versiones.
 * @param {string} revisionesId - ID de la carpeta de revisiones.
 * @param {string} estado_doc - Estado inicial del documento.
 * @param {string} email_usuario - Correo del autor.
 */
function registrarDocumento(nombre, fileIdRaiz, trabajoId, versionesId, revisionesId, estado_doc, email_usuario) {
  const sheet = getSheet_DOC();
  sheet.appendRow([
    new Date(),
    nombre,
    fileIdRaiz,
    trabajoId,
    versionesId,
    revisionesId,
    estado_doc,
    email_usuario
  ]);
}

/**
 * Recupera todos los documentos pertenecientes al usuario en sesión.
 * @returns {Array<Object>} Lista de documentos formateados.
 */
function obtenerDocumentos_Usuario() {
  const sheet = getSheet_DOC();
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const email = Session.getActiveUser().getEmail();
  return data
    .filter((row, i) => i > 0 && row[7] === email)
    .map(row => ({
      fecha: row[0] ? Utilities.formatDate(new Date(row[0]), Session.getScriptTimeZone(), "dd/MM/yyyy") : "Sin fecha",
      nombre: row[1],
      idRaiz: row[2],
      estado: row[6]
    }));
}

/**
 * Busca datos de un documento basándose en un ID de carpeta y un índice de columna.
 * @param {string} folderId - ID de la carpeta a buscar.
 * @param {number} indice - Índice de la columna en la hoja Documentos.
 * @returns {Object|null} Objeto con nombre e ID raíz del documento.
 */
function buscarDocDatosPorFolder(folderId, indice) {
  try {
    const sheet = getSheet_DOC();
    if (!sheet) return null;
    const data = sheet.getDataRange().getValues();
    const idBuscado = String(folderId).trim();
    const fila = data.find(r => String(r[indice]).trim() === idBuscado);
    if (fila) {
      return {
        nombre: fila[1],
        idOriginal: fila[2]
      };
    }
    return null;
  } catch (e) {
    console.error("Error en buscarDocDatos: " + e.toString());
    return null;
  }
}

/**
 * Obtiene el ID raíz asociado a una versión específica.
 * @param {string} idArchivoV - ID del archivo de versión.
 * @returns {string} ID del documento raíz.
 */
function obtenerIdRaizDesdeVersion(idArchivoV) {
  const sheetVer = getSheet_VER();
  const data = sheetVer.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === idArchivoV) {
      return data[i][0];
    }
  }
  throw new Error("No se encontró el ID raíz para la versión: " + idArchivoV);
}