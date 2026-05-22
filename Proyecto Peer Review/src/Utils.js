/**
 * Utils.js - Utilidades Genéricas y Herramientas Transversales
 * Contiene funciones de apoyo que son utilizadas por múltiples módulos.
 */

/**
 * Normaliza un nombre para ser usado en sistemas de archivos (sin acentos, espacios o caracteres especiales).
 * @param {string} nombre - El nombre original.
 * @returns {string} El nombre normalizado.
 */
function limpiarNombre(nombre) {
  if (!nombre) return "usuario_sin_nombre";
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .toLowerCase();
}

/**
 * Calcula el siguiente número correlativo para un archivo de revisión.
 * @param {string} folderId - ID de la carpeta de revisiones.
 * @param {string} nombreDoc - Nombre del documento original con su versión.
 * @returns {number} El siguiente número de revisión.
 * @throws {Error} Si el nombre del documento no tiene un formato de versión válido.
 */
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
 * Otorga permisos de edición a un usuario en un archivo de Drive sin enviar notificación por email.
 * @param {string} fileId - ID del archivo a compartir.
 * @param {string} emailRevisor - Correo electrónico del revisor.
 * @returns {boolean} True si se otorga el permiso correctamente.
 * @throws {Error} Si ocurre un error al crear los permisos.
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
