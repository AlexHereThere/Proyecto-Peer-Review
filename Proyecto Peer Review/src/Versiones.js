/**
 * Versiones.js - Orquestador del ciclo de vida de versiones.
 * Controla la inserción incremental de archivos de entrega y los procesos de borrado.
 */

// ==========================================
// 1. REGISTRO Y CARGA INCREMENTAL (ESCRITURA)
// ==========================================


/**
 * Inserta un nuevo registro en la tabla de Versiones.
 * @param {string} idDocRaiz - ID del archivo que actúa como raíz del documento.
 * @param {string} idArchivoV - ID del archivo físico de esta versión específica.
 * @param {number} numVersion - Número de versión (ej. 1, 2, 3).
 * @param {string} nombreV - Nombre asignado a esta versión.
 * @returns {number} Número de la última fila insertada.
 */
function registrarVersion(idDocRaiz, idArchivoV, numVersion, nombreV) {
  const sheet = getSheet_VER();
  sheet.appendRow([idDocRaiz, idArchivoV, numVersion, nombreV, new Date()]);
  SpreadsheetApp.flush();
  return sheet.getLastRow();
}

/**
 * Sube una nueva versión corregida de un documento existente.
 * Al subirse, queda limpia de revisores hasta que el Administrador los asigne manualmente.
 * @param {string} versionesFolderId - ID de la carpeta de versiones del proyecto.
 * @param {string} base64Data - Nuevos datos del PDF en Base64.
 * @returns {Object} Objeto con el estado de éxito, número de versión e ID del archivo.
 * @throws {Error} Si no se encuentra el registro del documento o falla la subida.
 */
function subirNuevaVersionServidor(versionesFolderId, base64Data) {
  try {
    const cleanedData = base64Data.replace(/[^A-Za-z0-9\+\/\=]/g, "");
    
    // Buscar los datos del documento raíz usando el ID de la carpeta de versiones
    const datos_doc = buscarDocDatosPorFolder(versionesFolderId, 4);
    if (!datos_doc) throw new Error("No se encontró el registro del documento.");

    const sheetVer = getSheet_VER();
    const todasLasVersiones = sheetVer.getDataRange().getValues();
    const numVersionesActuales = todasLasVersiones.filter(r => r[0] === datos_doc.idOriginal).length;
    const nuevoNumero = numVersionesActuales + 1;
    
    const nuevoNombre = `V${nuevoNumero}_${datos_doc.nombre}`;
    const idArchivo = subirArchivo(nuevoNombre, cleanedData, versionesFolderId);
    
    // Registrar la nueva versión física en la BD
    registrarVersion(datos_doc.idOriginal, idArchivo, nuevoNumero, nuevoNombre);
    
    // Registro de actividad
    const correoAutor = datos_doc.emailAutor || datos_doc.autor || Session.getActiveUser().getEmail();

    registrarActividad(
      correoAutor,                                                         // emailDueno
      datos_doc.nombre,                                                    // titulo
      "EntregaActualizada",                                                // tipo
      `Subida Versión ${nuevoNumero}. Esperando asignación de revisores.`, // detalle
      "text-primary",                                                      // claseCSS
      `abrirDocumento('${datos_doc.idOriginal}')`                          // accion_enlace
    );

    // === RECALCULO EN CASCADA ===
    ejecutarActualizacionDeEstadoMaestro(datos_doc.idOriginal);

    return { success: true, numero: nuevoNumero, id: idArchivo };

  } catch (e) {
    console.error(e.toString());
    throw new Error(`Error al subir nueva versión: ${e.message}`);
  }
}

// ==========================================
// 2. ELIMINACIÓN Y MANTENIMIENTO (BORRADO)
// ==========================================

/**
 * Gestiona la eliminación de versiones. Si es la única versión, elimina el proyecto completo.
 * @param {string} versionesFolderId - ID de la carpeta de versiones del proyecto.
 * @param {number} numeroVersion - El número de versión a eliminar.
 * @returns {Object} Objeto indicando si la eliminación fue completa o parcial.
 * @throws {Error} Si no se encuentra el registro maestro del documento.
 */
function eliminarVersionServidor(versionesFolderId, numeroVersion) {
  const sheetDoc = getSheet_DOC();
  const dataDoc = sheetDoc.getDataRange().getValues();
  const filaDoc = dataDoc.find(r => r[4] === versionesFolderId);
  
  if (!filaDoc) throw new Error("No se encontró el registro maestro del documento.");

  const idRaiz = filaDoc[2];          
  const idFolderTrabajo = filaDoc[3]; 
  const nombreDoc = filaDoc[1];       
  const emailAutorDoc = filaDoc[7]; // Índice 7 de la fila maestra (Email_Autor)

  const sheetVer = getSheet_VER();
  const dataVer = sheetVer.getDataRange().getValues();
  let idArchivoAEliminar = "";
  let filaIndexVer = -1;

  for (let i = 1; i < dataVer.length; i++) {
    if (dataVer[i][0] === idRaiz && dataVer[i][2] == numeroVersion) {
      idArchivoAEliminar = dataVer[i][1];
      filaIndexVer = i + 1;
      break;
    }
  }

  const versionesRestantes = dataVer.filter(r => r[0].toString().trim() === idRaiz.toString().trim()).length;

  // --- CASO A: Borrado Total (Única versión viva) ---
  if (versionesRestantes <= 1) {
    try {
      if (idFolderTrabajo) {
        DriveApp.getFolderById(idFolderTrabajo).setTrashed(true);
      }
    } catch (e) {
      console.warn("La carpeta ya no existía en Drive o no se pudo mover a la papelera.");
    }

    // Registro de actividad para borrado total
    registrarActividad(
      emailAutorDoc,          // emailDueno (Columna Email_Usuario)
      nombreDoc,              // titulo     (Columna Titulo_Doc)
      "SubmissionWithdrawn",  // tipo       (Columna Tipo_Evento)
      "Se eliminó el proyecto completo de Drive y el registro.", // detalle (Columna Detalle_Display)
      "text-danger",          // claseCSS   (Columna Clase_CSS)
      ""                      // accion_enlace (Columna Accion_Enlace - Vacío por eliminación)
    );
    
    eliminarRegistrosRelacionados(idRaiz);
    
    return { eliminadoCompleto: true };
  }

  // --- CASO B: Borrado Parcial (Existen más versiones) ---
  if (idArchivoAEliminar) {
    try {
      DriveApp.getFileById(idArchivoAEliminar).setTrashed(true);
      sheetVer.deleteRow(filaIndexVer);
      
      const sheetRev = getSheet_REV();
      const dataRev = sheetRev.getDataRange().getValues();
      for (let j = dataRev.length - 1; j >= 1; j--) {
        if (dataRev[j][0] === idArchivoAEliminar) {
          sheetRev.deleteRow(j + 1);
        }
      }
      
      limpiarEnlacesDeActividad(idArchivoAEliminar);
      
      // Registro de actividad para borrado parcial
      registrarActividad(
        emailAutorDoc,             // emailDueno
        nombreDoc,                 // titulo
        "Ver_SubmissionWithdrawn", // tipo
        `Se eliminó la versión ${numeroVersion}.`, // detalle
        "bg-danger text-white",    // claseCSS
        `abrirDocumento('${idRaiz}')` // accion_enlace
      );
      
      // Recalcular estado maestro con lo que quedó en la base de datos
      ejecutarActualizacionDeEstadoMaestro(idRaiz);
      
    } catch (e) {
      console.warn("El archivo físico de la versión no se pudo borrar de Drive: " + e.message);
    }
  }

  return { eliminadoCompleto: false };
}