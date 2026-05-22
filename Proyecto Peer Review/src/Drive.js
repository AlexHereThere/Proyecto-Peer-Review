/**
 * Drive.js - Gestión de Estructura de Archivos y Carpetas
 */

// --- 1. Gestión de Estructura (Carpetas) ---

/**
 * Obtiene una carpeta por su nombre dentro de una carpeta padre específica. 
 * Si no existe, procede a crearla.
 * @param {string} nombre - El nombre de la carpeta a buscar o crear.
 * @param {GoogleAppsScript.Drive.Folder} padre - El objeto carpeta (Folder) donde se realizará la búsqueda.
 * @returns {GoogleAppsScript.Drive.Folder} El objeto de la carpeta encontrada o creada.
 */
function obtenerOCrearCarpeta(nombre, padre) {
  const iter = padre.getFoldersByName(nombre);
  return iter.hasNext() ? iter.next() : padre.createFolder(nombre);
}

/**
 * Asegura la existencia de la carpeta raíz de la aplicación en Google Drive.
 * @returns {GoogleAppsScript.Drive.Folder} El objeto de la carpeta raíz "AppPeerReviewUABC".
 */
function obtenerCarpetaRaiz() {
  const RAIZ_NOMBRE = "AppPeerReviewUABC";
  const iter = DriveApp.getFoldersByName(RAIZ_NOMBRE);
  return iter.hasNext() ? iter.next() : DriveApp.createFolder(RAIZ_NOMBRE);
}

/**
 * Crea o recupera la carpeta base del usuario utilizando su email como identificador.
 * @param {string} email - El correo electrónico del usuario.
 * @returns {string} El ID de la carpeta de usuario creada o recuperada.
 */
function inicializarCarpetaUsuario(email) {
  const raiz = obtenerCarpetaRaiz();
  return obtenerOCrearCarpeta(email, raiz).getId();
}

/**
 * Crea la estructura jerárquica necesaria para un nuevo trabajo de revisión:
 * Carpeta principal -> subcarpetas 'versiones' y 'revisiones'.
 * @param {string} nombreTrabajo - Nombre descriptivo para el trabajo.
 * @param {string} folderIdUsuario - ID de la carpeta raíz del usuario.
 * @returns {Object} Objeto con los IDs de las carpetas: {trabajoId, versionesId, revisionesId}.
 */
function crearCarpetaTrabajo(nombreTrabajo, folderIdUsuario) {
  const carpetaRaizUsuario = DriveApp.getFolderById(folderIdUsuario);
  const carpetaTrabajo = carpetaRaizUsuario.createFolder(`Trabajo_${nombreTrabajo}`);
  
  return {
    trabajoId: carpetaTrabajo.getId(),
    versionesId: carpetaTrabajo.createFolder("versiones").getId(),
    revisionesId: carpetaTrabajo.createFolder("revisiones").getId()
  };
}

// --- 2. Manipulación de Archivos ---

/**
 * Decodifica una cadena Base64 y crea un archivo PDF físico en la carpeta destino.
 * @param {string} nombre - Nombre que se asignará al nuevo archivo.
 * @param {string} base64 - Contenido del archivo codificado en Base64.
 * @param {string} folderId - ID de la carpeta donde se guardará el archivo.
 * @returns {string} El ID del archivo recién creado.
 */
function subirArchivo(nombre, base64, folderId) {
  const folder = DriveApp.getFolderById(folderId);
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), "application/pdf", nombre);
  return folder.createFile(blob).getId();
}

/**
 * Realiza una copia de un archivo existente hacia una nueva carpeta de destino.
 * @param {string} fileId - ID del archivo original a copiar.
 * @param {string} nuevoNombre - El nombre que tendrá la copia resultante.
 * @param {string} folderId - ID de la carpeta de destino.
 * @returns {string} El ID de la copia generada.
 */
function copiarArchivo(fileId, nuevoNombre, folderId) {
  const carpeta = DriveApp.getFolderById(folderId);
  const copia = DriveApp.getFileById(fileId).makeCopy(nuevoNombre, carpeta);
  return copia.getId();
}

/**
 * Actualiza el contenido binario de un archivo existente en Drive.
 * Requiere que el servicio Avanzado de Drive esté habilitado.
 * @param {string} fileId - ID del archivo a actualizar.
 * @param {string} base64Data - Nuevos datos en formato Base64.
 * @returns {Object} Respuesta de la API de Drive tras la actualización.
 */
function actualizarContenidoArchivo(fileId, base64Data) {
  const bytes = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(bytes, "application/pdf");
  return Drive.Files.update({}, fileId, blob);
}

/**
 * Obtiene la información de un archivo PDF y la codifica en Base64 para su uso en el cliente.
 * @param {string} fileId - El ID del archivo a recuperar.
 * @returns {Object} Objeto con bytes (base64), fileName y fileId.
 * @throws {Error} Si el ID de archivo no es proporcionado o no se puede acceder al archivo.
 */
function getPDFData(fileId) {
  try {
    if (!fileId) throw new Error("ID de archivo no proporcionado.");
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    
    return {
      bytes: Utilities.base64Encode(blob.getBytes()),
      fileName: file.getName(),
      fileId: fileId
    };
  } catch (e) {
    Logger.log(`Error en getPDFData: ${e.message}`);
    throw new Error(`No se pudo acceder al PDF solicitado.`);
  }
}