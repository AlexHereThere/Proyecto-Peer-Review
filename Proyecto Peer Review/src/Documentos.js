/**
 * @fileoverview Documentos.gs - Motor maestro y gestión de documentos.
 * Centraliza la orquestación de subidas de autores, consultas para el frontend
 * y el cálculo inductivo de los estados de los documentos del sistema.
 */

// ==========================================
// 1. FLUJOS DE AUTOR (ESCRITURA Y ORQUESTRACIÓN)
// ==========================================

/**
 * Gestiona el flujo completo de creación de un documento: crea carpetas en Drive, 
 * sube el archivo físico y registra los datos en las tablas relacionales.
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
  
  // === CORREGIDO ÚNICAMENTE ESTA LÍNEA (Alineada con tus 6 columnas) ===
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
 * MODIFICADO: Ahora detecta el rol del usuario actual y aplica 'obtenerIdentidadesVisibles' en el mapeo.
 * @param {string} idRaiz - ID del documento raíz a consultar.
 * @returns {Object|null} Objeto con el árbol de versiones/revisiones sanitizado.
 */
function obtenerDetalleDocumento(idRaiz) {
  try {
    const emailLogueado = Session.getActiveUser().getEmail();
    
    // Consulta Maestro (Documentos)
    const sheetDoc = getSheet_DOC();
    const dataDoc = sheetDoc.getDataRange().getValues();
    const filaDoc = dataDoc.find(r => r[2] === idRaiz);
    if (!filaDoc) return null;
    
    const emailAutorOriginal = filaDoc[7];
    // Determinar rol contextual (Autor, Revisor, Admin)
    const rolUsuarioActual = determinarRolDeUsuarioEnDocumento(idRaiz, emailLogueado);
    
    // Consulta Relacional (Versiones)
    const sheetVer = getSheet_VER();
    const dataVer = sheetVer.getDataRange().getValues();
    const versionesVinculadas = dataVer.filter(r => r[0] === idRaiz);
    
    // Consulta Relacional (Revisiones)
    const sheetRev = getSheet_REV();
    const dataRev = sheetRev.getDataRange().getValues();
    
    const historialVersiones = versionesVinculadas.map(v => {
      const idArchivoV = v[1];
      const revsDeEstaVersion = dataRev.filter(r => r[0] === idArchivoV).map(r => {
        const emailRevisorOriginal = r[3];
        const tipoRevisionOriginal = r[6] || "Doble Ciego"; // Columna 7 de Revisiones
        
        // INTERCEPTOR DE ANONIMATO SÍNCRONO
        const identidades = obtenerIdentidadesVisibles(tipoRevisionOriginal, emailAutorOriginal, emailRevisorOriginal, rolUsuarioActual);
        
        return {
          numero: r[2],
          revisor: identidades.revisor, // Envía "Anónimo (Revisor)" si corresponde
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
 * Obtiene todos los documentos del sistema para el panel admin. Sin ofuscación de datos.
 */
function obtenerTodosDocumentos() {
  const sheet = getSheet_DOC();
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
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

// ==========================================
// 3. MOTOR DE REGLAS DE NEGOCIO (CALCULO DE ESTADOS)
// ==========================================

/**
 * Determina el estado de un documento analizando inductivamente sus versiones y revisiones.
 * CORREGIDO: Se optimiza la manipulación de arreglos con .slice(1) para no mutar las sábanas de datos originales.
 */
function determinarEstadoDocumento(idArchivo) {
  let idRaiz = idArchivo;
  
  try {
    const dataVer = getSheet_VER().getDataRange().getValues();
    const esIdVersion = dataVer.some(row => row[1] === idArchivo);
    if (esIdVersion) {
      idRaiz = obtenerIdRaizDesdeVersion(idArchivo);
    }
  } catch (e) {
    console.warn("Tratando parámetro como ID raíz directo.");
  }

  const datosVersiones = getSheet_VER().getDataRange().getValues();
  const datosRevisiones = getSheet_REV().getDataRange().getValues();
  
  // CORRECCIÓN: Usar slice(1) evita mutar las sábanas de datos con un shift directo si se vuelven a usar
  const cabecerasV = datosVersiones[0] || [];
  const filasVersiones = datosVersiones.slice(1);
  
  const idxIdDocRaiz = cabecerasV.indexOf("ID_Documento_Raiz");
  const idxIdArchivoV = cabecerasV.indexOf("ID_Archivo_V");
  const idxNumVersion = cabecerasV.indexOf("Numero_Version");
  
  const versionesDelDoc = filasVersiones.filter(fila => fila[idxIdDocRaiz] === idRaiz);
  if (versionesDelDoc.length === 0) return "Pendiente";
  
  const versionMasNueva = versionesDelDoc.reduce((max, actual) => 
    actual[idxNumVersion] > max[idxNumVersion] ? actual : max
  , versionesDelDoc[0]);
  
  const idVersionMasNueva = versionMasNueva[idxIdArchivoV];
  const todosIdsVersiones = new Set(versionesDelDoc.map(v => v[idxIdArchivoV]));

  const cabecerasR = datosRevisiones[0] || [];
  const filasRevisiones = datosRevisiones.slice(1);
  
  const idxIdArchivoV_R = cabecerasR.indexOf("ID_Archivo_V");
  const idxEstadoR = cabecerasR.indexOf("Estado");
  
  const revisionesDeCualquierVersion = [];
  const revisionesVersionMasNueva = [];
  
  filasRevisiones.forEach(fila => {
    const idArchV = fila[idxIdArchivoV_R];
    if (todosIdsVersiones.has(idArchV)) {
      revisionesDeCualquierVersion.push(fila);
      if (idArchV === idVersionMasNueva) {
        revisionesVersionMasNueva.push(fila);
      }
    }
  });

  // --- REGLAS DE NEGOCIO ---

  // REGLA 1: Si hay revisiones en proceso ("Asignado", "En revisión") en CUALQUIER versión.
  const tieneRevisionActiva = revisionesDeCualquierVersion.some(fila => {
    const est = String(fila[idxEstadoR]).trim().toLowerCase();
    return est === "asignado" || est === "en revisión" || est === "en revision" || est === "nuevo";
  });
  if (tieneRevisionActiva) return "En revisión";

  // REGLA 2: Si una revisión de la versión actual solicita corrección.
  const tieneCorrecionEnNueva = revisionesVersionMasNueva.some(fila => {
    return String(fila[idxEstadoR]).trim().toLowerCase() === "a corregir";
  });
  if (tieneCorrecionEnNueva) return "A Corregir";

  // REGLA 3: Si la versión actual ya cuenta con todas sus revisiones aprobadas formalmente.
  if (revisionesVersionMasNueva.length > 0) {
    const todasAprobadas = revisionesVersionMasNueva.every(fila => {
      return String(fila[idxEstadoR]).trim().toLowerCase() === "aprobado";
    });
    if (todasAprobadas) return "Aprobado";
  }

  return "Pendiente";
}

/**
 * Ejecuta el cálculo físico del estado y lo guarda en la base de datos relacional de 'Documentos'.
 */
function ejecutarActualizacionDeEstadoMaestro(idRaiz) {
  const nuevoEstado = determinarEstadoDocumento(idRaiz);
  const sheetDoc = getSheet_DOC();
  const dataDoc = sheetDoc.getDataRange().getValues();
  
  const filaIndice = dataDoc.findIndex(row => row[2] === idRaiz);
  if (filaIndice !== -1) {
    sheetDoc.getRange(filaIndice + 1, 7).setValue(nuevoEstado); 
    console.log(`[Sincronizador] Documento ID ${idRaiz} updated to: ${nuevoEstado}`);
  }
}

/**
 * FUNCIÓN AUXILIAR CONTEXTUAL: Determina el rol de un usuario respecto a un documento específico.
 * @private
 */
function determinarRolDeUsuarioEnDocumento(idRaiz, email) {
  if (typeof verificarEsAdmin === "function" && verificarEsAdmin(email)) return "admin";
  
  const filaDoc = getSheet_DOC().getDataRange().getValues().find(row => row[2] === idRaiz);
  if (filaDoc && filaDoc[7] === email) return "autor";
  
  return "revisor"; 
}