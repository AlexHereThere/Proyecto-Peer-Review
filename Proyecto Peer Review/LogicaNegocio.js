/**
 * LogicaNegocio.gs - Sistema de Gestión Documental Relacional
 */

/**
 * Configura la infraestructura inicial del sistema: crea la hoja de cálculo de base de datos
 * y define el esquema de tablas si no existen.
 * * @returns {string} El ID de la hoja de cálculo (Spreadsheet) del sistema.
 */
function inicializarSistema() {
  const props = PropertiesService.getScriptProperties();
  let sheetId = props.getProperty('SHEET_ID');
  let padreId = props.getProperty('PROJECT_FOLDER_ID');

  if (sheetId) {
    try {
      const file = DriveApp.getFileById(sheetId);
      if (!file.isTrashed()) return sheetId;
    } catch (e) {
      console.warn("ID previo no válido. Reconfigurando...");
    }
  }

  const carpetaPadre = DriveApp.getFolderById(padreId);
  const carpetaDB = obtenerOCrearCarpeta("Base de Datos", carpetaPadre);
  
  let ss;
  const iterSheet = carpetaDB.getFilesByName("Datos del Sistema");
  
  if (iterSheet.hasNext()) {
    ss = SpreadsheetApp.open(iterSheet.next());
  } else {
    ss = SpreadsheetApp.create("Datos del Sistema");
    DriveApp.getFileById(ss.getId()).moveTo(carpetaDB);
  }

  // ESQUEMA RELACIONAL: Definición de tablas y sus estructuras
  const esquema = [
    { nombre: "Usuarios", cabeceras: ["Email_Usuario", "Nombre_Usuario", "Roles", "ID_G_Carpeta", "Fecha_Registro"] },
    { nombre: "Documentos", cabeceras: ["Fecha", "Nombre_Archivo", "ID_Documento_Raiz", "ID_G_Trabajo", "ID_G_Versiones", "ID_G_Revisiones", "Estado", "Email_Autor"] },
    { nombre: "Versiones", cabeceras: ["ID_Documento_Raiz", "ID_Archivo_V", "Numero_Version", "Nombre_Archivo_V", "Fecha_Subida"] },
    { nombre: "Revisiones", cabeceras: ["ID_Archivo_V", "ID_Archivo_R", "Numero_Revision", "Email_Revisor", "Estado", "Fecha"] },
    { nombre: "Actividad", cabeceras: ["ID_Actividad","Email_Usuario","Titulo_Doc","Tipo_Evento","Detalle_Display","Clase_CSS","Fecha","Accion_Enlace"]}
  ];

  esquema.forEach(tabla => asegurarHoja(ss, tabla.nombre, tabla.cabeceras));

  props.setProperty('SHEET_ID', ss.getId());
  return ss.getId();
}

/**
 * Garantiza la existencia de una hoja y sus cabeceras. Si no existe, la crea.
 * * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss - Instancia de la hoja de cálculo.
 * @param {string} nombre - Nombre de la hoja deseada.
 * @param {Array<string>} cabeceras - Lista de títulos para la primera fila.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} La hoja asegurada.
 */
function asegurarHoja(ss, nombre, cabeceras) {
  let sheet = ss.getSheetByName(nombre);
  if (!sheet) {
    sheet = ss.insertSheet(nombre);
    sheet.getRange(1, 1, 1, cabeceras.length).setValues([cabeceras]).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Elimina en cascada todas las referencias de un documento en las tablas 
 * de Documentos, Versiones y Revisiones, e inactiva sus enlaces de actividad.
 * @param {string} idRaiz - El ID_Documento_Raiz (ID_Archivo_V1).
 * @returns {boolean} True si la eliminación fue exitosa.
 * @throws {Error} Si ocurre un error en la limpieza de registros.
 */
function eliminarRegistrosRelacionados(idRaiz) {
  try {
    // Obtener IDs de todas las versiones para cascada hacia revisiones
    const sheetVer = getSheet_VER();
    const dataVer = sheetVer.getDataRange().getValues();
    
    const idsArchivosVersiones = dataVer
      .filter(fila => fila[0] === idRaiz)
      .map(fila => fila[1]);

    // Limpiar tabla 'Revisiones'
    const sheetRev = getSheet_REV();
    const dataRev = sheetRev.getDataRange().getValues();
    for (let i = dataRev.length - 1; i >= 1; i--) {
      if (idsArchivosVersiones.includes(dataRev[i][0])) {
        sheetRev.deleteRow(i + 1);
      }
    }

    // Limpiar tabla 'Versiones'
    for (let i = dataVer.length - 1; i >= 1; i--) {
      if (dataVer[i][0] === idRaiz) {
        sheetVer.deleteRow(i + 1);
      }
    }

    // Limpiar tabla 'Documentos' (Maestro)
    const sheetDoc = getSheet_DOC();
    const dataDoc = sheetDoc.getDataRange().getValues();
    for (let i = dataDoc.length - 1; i >= 1; i--) {
      if (dataDoc[i][2] === idRaiz) {
        sheetDoc.deleteRow(i + 1);
        break; 
      }
    }

    // Inactivar enlaces en el historial de actividad
    limpiarEnlacesDeActividad(idRaiz);

    console.log("Limpieza relacional exitosa para ID_Raiz: " + idRaiz);
    return true;

  } catch (e) {
    console.error("Error en eliminarRegistrosRelacionados: " + e.toString());
    throw new Error("No se pudo completar la limpieza de la base de datos.");
  }
}