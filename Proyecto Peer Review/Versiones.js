/**
 * Inserta un nuevo registro en la tabla de Versiones.
 * * @param {string} idDocRaiz - ID del archivo que actúa como raíz del documento.
 * @param {string} idArchivoV - ID del archivo físico de esta versión específica.
 * @param {number} numVersion - Número de versión (ej. 1, 2, 3).
 * @param {string} nombreV - Nombre asignado a esta versión.
 * @return {int} - numero de la ultima fila.
 */
function registrarVersion(idDocRaiz, idArchivoV, numVersion, nombreV) {
  const sheet = getSheet_VER();

  sheet.appendRow([idDocRaiz, idArchivoV, numVersion, nombreV, new Date()]);
  SpreadsheetApp.flush();
  return sheet.getLastRow();
}

/**
 * Sube una nueva versión corregida de un documento existente, 
 * autodetectando el número correlativo (V2, V3, etc.).
 * @param {string} versionesFolderId - ID de la carpeta de versiones del proyecto.
 * @param {string} base64Data - Nuevos datos del PDF en Base64.
 * @return {object} - Objeto con el estado de éxito, número de versión e ID del archivo.
 */
function subirNuevaVersionServidor(versionesFolderId, base64Data) {
  try {
    const cleanedData = base64Data.replace(/[^A-Za-z0-9\+\/\=]/g, "");
    
    // Obtener datos del documento raíz mediante la carpeta
    const datos_doc = buscarDocDatosPorFolder(versionesFolderId, 4); // Índice 4 = ID_G_Versiones
    if (!datos_doc) throw new Error("No se encontró el registro del documento.");

    // Determinar el siguiente número consultando la base de datos (más seguro que contar archivos)
    const sheetVer = getSheet_VER();
    const todasLasVersiones = sheetVer.getDataRange().getValues();
    const numVersionesActuales = todasLasVersiones.filter(r => r[0] === datos_doc.idOriginal).length;
    const nuevoNumero = numVersionesActuales + 1;
    
    // Subir archivo físico
    const nuevoNombre = `V${nuevoNumero}_${datos_doc.nombre}`;
    const idArchivo = subirArchivo(nuevoNombre, cleanedData, versionesFolderId);
    
    // Registrar en la tabla de Versiones
    registrarVersion(datos_doc.idOriginal, idArchivo, nuevoNumero, nuevoNombre);
    
    // Bitácora
    registrarActividad(
      datos_doc.nombre,
      "EntregaActualizada",
      `Subida Versión ${nuevoNumero}.`,
      "text-primary",
      `abrirDocumento('${datos_doc.idOriginal}')`
    );

    return { success: true, numero: nuevoNumero, id: idArchivo };
  } catch (e) {
    console.error(e.toString());
    throw new Error(`Error al subir nueva versión: ${e.message}`);
  }
}
// --- Eliminación y Mantenimiento ---

/**
 * Gestiona la eliminación de versiones. Si es la única versión, elimina el proyecto completo.
 * Si hay múltiples, elimina la seleccionada y renombra las restantes.
 * @param {string} versionesFolderId - ID de la carpeta de versiones.
 * @param {number} numeroVersion - El número de la versión a eliminar (ej. 1, 2).
 * @return {object} - Objeto indicando si la eliminación fue total o parcial.
 */
function eliminarVersionServidor(versionesFolderId, numeroVersion) {
  
  // Buscamos el documento en la tabla maestro 'Documentos' 
  const sheetDoc = getSheet_DOC();
  const dataDoc = sheetDoc.getDataRange().getValues();
  // Índice 4 = ID_G_Versiones
  const filaDoc = dataDoc.find(r => r[4] === versionesFolderId);
  
  if (!filaDoc) throw new Error("No se encontró el registro maestro del documento.");

  const idRaiz = filaDoc[2];      // ID_Documento_Raiz
  const idFolderTrabajo = filaDoc[3]; // ID_G_Trabajo (Carpeta principal)
  const nombreDoc = filaDoc[1];   // Nombre_Archivo

  // Localizar la versión específica en la tabla 'Versiones'
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

  // --- CASO A: Borrado Total (Es la última versión) ---
  if (versionesRestantes <= 1) {
    // BORRADO FÍSICO: Borramos la carpeta de trabajo completa
    try {
      if (idFolderTrabajo) {
        DriveApp.getFolderById(idFolderTrabajo).setTrashed(true);
      }
    } catch (e) {
      console.warn("La carpeta ya no existía en Drive.");
    }

    // REGISTRO: Bitácora e inactivación de enlaces
    registrarActividad(nombreDoc, "SubmissionWithdrawn", "Se eliminó el proyecto completo de Drive y el registro.", "text-danger", "");
    
    // LIMPIEZA DE TABLAS: Cascada (Revisiones -> Versiones -> Documentos)
    eliminarRegistrosRelacionados(idRaiz);
    
    return { eliminadoCompleto: true };
  }

  // --- CASO B: Borrado Parcial ---
  if (idArchivoAEliminar) {
    try {
      DriveApp.getFileById(idArchivoAEliminar).setTrashed(true);
      sheetVer.deleteRow(filaIndexVer);
      
      // Limpiar revisiones de esa versión en la tabla
      const sheetRev = getSheet_REV();
      const dataRev = sheetRev.getDataRange().getValues();
      for (let j = dataRev.length - 1; j >= 1; j--) {
        if (dataRev[j][0] === idArchivoAEliminar) {
          sheetRev.deleteRow(j + 1);
        }
      }
      
      limpiarEnlacesDeActividad(idArchivoAEliminar);
      registrarActividad(nombreDoc, "Ver_SubmissionWithdrawn", `Se eliminó la versión ${numeroVersion}.`, "bg-danger text-white", `abrirDocumento('${idRaiz}')`);
      
    } catch (e) {
      console.warn("El archivo de la versión no se pudo borrar.");
    }
  }

  return { eliminadoCompleto: false };
}
