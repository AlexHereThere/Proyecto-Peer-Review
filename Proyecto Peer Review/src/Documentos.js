/**
 * Documentos.js - Motor maestro y gestión de documentos.
 * Centraliza la orquestación de subidas de autores, consultas para el frontend
 * y el cálculo inductivo de los estados de los documentos del sistema.
 */

// ==========================================
// 1. FLUJOS DE AUTOR (ESCRITURA Y ORQUESTRACIÓN)
// ==========================================

/**
 * Gestiona el flujo completo de creación de un documento: crea carpetas en Drive, 
 * sube el archivo físico y registra los datos en las tablas relacionales.
 * @param {string} nombreDoc - El nombre del documento a subir.
 * @param {string} base64 - El contenido del archivo en formato base64.
 * @returns {boolean} True si el proceso se completa correctamente.
 * @throws {Error} Si el usuario no está registrado.
 */
function orquestarSubidaOriginal(nombreDoc, base64) {
  const email = Session.getActiveUser().getEmail();
  const usuario = buscarUsuario(email);
  if (!usuario?.folderId) throw new Error("Usuario no registrado.");
  
  const nombreLimpio = nombreDoc.replace(/\.[^/.]+$/, "");
  const carpetas = crearCarpetaTrabajo(nombreLimpio, usuario.folderId);
  
  // Subir el archivo físico (Versión 1)
  const idArchivoV1 = subirArchivo("V1_" + nombreDoc, base64, carpetas.versionesId);
  
  // Registro relacional indexado
  registrarDocumento(nombreDoc, idArchivoV1, carpetas.trabajoId, carpetas.versionesId, carpetas.revisionesId, "Pendiente", email);
  registrarVersion(idArchivoV1, idArchivoV1, 1, "V1_" + nombreDoc);
  
  // Registro de actividad
  registrarActividad(
    email,                               // 1. Email_Usuario
    nombreDoc,                           // 2. Titulo_Doc
    "SubmissionCreated",                 // 3. Tipo_Evento
    "Subió un nuevo documento.",         // 4. Detalle_Display
    "text-primary",                      // 5. Clase_CSS
    `abrirDocumento('${idArchivoV1}')`   // 6. Accion_Enlace
  );
  
  return true;
}

/**
 * Registra el documento maestro en la tabla 'Documentos'.
 * @param {string} nombre - Nombre del documento.
 * @param {string} fileIdRaiz - ID del archivo de la primera versión.
 * @param {string} trabajoId - ID de la carpeta de trabajo.
 * @param {string} versionesId - ID de la carpeta de versiones.
 * @param {string} revisionesId - ID de la carpeta de revisiones.
 * @param {string} estado_doc - Estado inicial del documento.
 * @param {string} email_usuario - Correo electrónico del autor.
 * @private
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

// ==========================================
// 2. VISTAS Y CONSULTAS (READ-ONLY PARA FRONTEND / ADMIN)
// ==========================================

/**
 * Obtiene el historial completo de un documento aplicando reglas de anonimato en tiempo real.
 * @param {string} idRaiz - ID del documento raíz a consultar.
 * @returns {Object|null} Objeto con el árbol de versiones/revisiones sanitizado o null si ocurre un error.
 */
function obtenerDetalleDocumento(idRaiz) {
  try {
    const emailLogueado = Session.getActiveUser().getEmail();
    
    // Consulta Maestro (Documentos) - Optimizado con findRowInSheet
    const filaDoc = findRowInSheet("Documentos", 2, idRaiz);
    if (!filaDoc) return null;
    
    const emailAutorOriginal = filaDoc[7];
    const rolUsuarioActual = determinarRolDeUsuarioEnDocumento(idRaiz, emailLogueado);
    
    // Consulta Relacional (Versiones) - Optimizado con filterRowsInSheet
    const versionesVinculadas = filterRowsInSheet("Versiones", 0, idRaiz);
    
    // Consulta Relacional (Revisiones) - Carga de una sola vez para búsqueda rápida
    const dataRev = getSheetData("Revisiones");
    
    const historialVersiones = versionesVinculadas.map(v => {
      const idArchivoV = v[1];
      const revsDeEstaVersion = dataRev.filter(r => r[0] === idArchivoV).map(r => {
        const emailRevisorOriginal = r[3];
        const tipoRevisionOriginal = r[6] || "Doble Ciego";
        
        const identidades = obtenerIdentidadesVisibles(tipoRevisionOriginal, emailAutorOriginal, emailRevisorOriginal, rolUsuarioActual);
        
        return {
          numero: r[2],
          revisor: identidades.revisor,
          estado: r[4],
          tipoRevision: tipoRevisionOriginal,
          fecha: r[5] ? Utilities.formatDate(new Date(r[5]), Session.getScriptTimeZone(), "dd/MM/yyyy") : "-",
          fileId: r[1]
        };
      });
      
      return {
        numero: v[2],
        fileId: idArchivoV,
        nombre: v[3],
        revisiones: revsDeEstaVersion
      };
    });
    
    return {
      nombre: filaDoc[1],
      autor: rolUsuarioActual === "admin" || rolUsuarioActual === "revisor" ? obtenerIdentidadesVisibles("Doble Ciego", emailAutorOriginal, "", rolUsuarioActual).autor : emailAutorOriginal,
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
 * Recupera todos los documentos pertenecientes al usuario en sesión.
 * @returns {Array<Object>} Lista de documentos simplificada para el autor.
 */
function obtenerDocumentos_Usuario() {
  const data = getSheetData("Documentos");
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
 * Obtiene todos los documentos del sistema para el panel admin. Sin ofuscación de datos.
 * @returns {Array<Object>} Lista completa de documentos registrada en el sistema.
 */
function obtenerTodosDocumentos() {
  const data = getSheetData("Documentos");
  if (data.length <= 1) return [];

  return data.slice(1).map(row => ({
    fecha:        row[0] ? Utilities.formatDate(new Date(row[0]), Session.getScriptTimeZone(), "dd/MM/yyyy") : "Sin fecha",
    nombre:       row[1],
    idRaiz:       row[2],
    versionesId:  row[4],
    revisionesId: row[5],
    estado:       row[6],
    autor:        row[7]
  }));
}

/**
 * Busca datos de un documento basándose en un ID de carpeta y un índice de columna.
 * @param {string} folderId - El ID de la carpeta a buscar.
 * @param {number} indice - El índice de la columna en la hoja de Documentos.
 * @returns {Object|null} Objeto con nombre e idOriginal o null si no se encuentra.
 */
function buscarDocDatosPorFolder(folderId, indice) {
  try {
    const fila = findRowInSheet("Documentos", indice, folderId);
    if (fila) {
      return {
        nombre: fila[1],
        idOriginal: fila[2],
        emailAutor: fila[7]
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
 * @param {string} idArchivoV - ID del archivo de la versión.
 * @returns {string} ID del documento raíz.
 * @throws {Error} Si no se encuentra el ID raíz.
 */
function obtenerIdRaizDesdeVersion(idArchivoV) {
  const fila = findRowInSheet("Versiones", 1, idArchivoV);
  if (fila) return fila[0];
  throw new Error("No se encontró el ID raíz para la versión: " + idArchivoV);
}

// ==========================================
// 3. MOTOR DE REGLAS DE NEGOCIO (CALCULO DE ESTADOS)
// ==========================================

/**
 * Ejecuta el cálculo físico del estado y lo guarda en la base de datos relacional de 'Documentos'.
 * @param {string} idRaiz - ID del documento raíz.
 */
function ejecutarActualizacionDeEstadoMaestro(idRaiz) {
  const nuevoEstado = determinarEstadoDocumento(idRaiz);
  const ss = getSpreed();
  const sheetDoc = ss.getSheetByName("Documentos");
  const dataDoc = getSheetData("Documentos");

  const filaIndice = dataDoc.findIndex(row => row[2] === idRaiz);
  if (filaIndice !== -1) {
    sheetDoc.getRange(filaIndice + 1, 7).setValue(nuevoEstado); 
    console.log(`[Sincronizador] Documento ID ${idRaiz} updated to: ${nuevoEstado}`);
  }
}

/**
 * Determina el rol de un usuario respecto a un documento específico.
 * @param {string} idRaiz - ID del documento raíz.
 * @param {string} email - Correo electrónico del usuario.
 * @returns {string} El rol ("admin", "autor" o "revisor").
 * @private
 */
function determinarRolDeUsuarioEnDocumento(idRaiz, email) {
  if (typeof verificarEsAdmin === "function" && verificarEsAdmin(email)) return "admin";

  const filaDoc = findRowInSheet("Documentos", 2, idRaiz);
  if (filaDoc && filaDoc[7] === email) return "autor";

  return "revisor"; 
}