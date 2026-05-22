/**
 * User.js - Utilidades de Texto, Identidad y Gestión de Sesión
 */

/**
 * Obtiene la información del usuario actual desde Google (People API o fallback).
 * @returns {Object} Objeto con id, name, email y photo del usuario.
 */
function sacarGoogleInfoUsuario() {
  const email = Session.getActiveUser().getEmail();
  let name, photo, id;

  try {
    const profile = People.People.get("people/me", {
      personFields: "names,photos"
    });
    name = profile.names?.[0]?.displayName;
    photo = profile.photos?.[0]?.url;
    id = profile.resourceName;
  } catch (e) {
    console.warn("People API no disponible, usando fallback.");
  }

  if (!name) {
    try {
      const response = UrlFetchApp.fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${ScriptApp.getOAuthToken()}` }
      });
      const info = JSON.parse(response.getContentText());
      id = info.sub;
      name = info.name || info.given_name;
      photo = photo || info.picture;
    } catch (e) {
      console.error(`Error en fallback de identidad: ${e.message}`);
    }
  }

  name = name || email.split("@")[0];
  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00723f&color=fff&size=200`;
  photo = photo || defaultAvatar;

  return { id, name, email, photo };
}

/**
 * Verifica si un usuario tiene el rol de administrador.
 * @param {string} email - El correo electrónico del usuario.
 * @returns {boolean} True si es administrador, false en caso contrario.
 */
function verificarEsAdmin(email) {
  try {
    const fila = findRowInSheet("Usuarios", 0, email);
    if (!fila) return false;
    const roles = fila[2] ? fila[2].toString().split(",").map(r => r.trim()) : [];
    return roles.includes("Admin");
  } catch(e) {
    console.error("Error en verificarEsAdmin: " + e.message);
    return false;
  }
}

/**
 * Verifica si un usuario tiene un rol específico.
 * @param {string} email - El correo electrónico del usuario.
 * @param {string} rol - El rol a verificar (Admin, Revisor, Autor).
 * @returns {boolean} True si tiene el rol, false en caso contrario.
 */
function tieneRol(email, rol) {
  try {
    const fila = findRowInSheet("Usuarios", 0, email);
    if (!fila) return false;
    const roles = fila[2] ? fila[2].toString().split(",").map(r => r.trim()) : [];
    return roles.includes(rol);
  } catch(e) {
    console.error("Error en tieneRol: " + e.message);
    return false;
  }
}

/**
 * Inicializa la sesión del usuario actual. Registra al usuario si es nuevo
 * y crea su carpeta de trabajo en Drive.
 * @returns {Object} Información de la sesión (esNuevo, folderId, roles).
 * @throws {Error} Si ocurre un error crítico durante la inicialización.
 */
function inicializarUsuario() {
  try {
    const { email, name } = sacarGoogleInfoUsuario();
    const usuario = buscarUsuario(email);
    const esAdmin   = tieneRol(email, "Admin");
    const esRevisor = tieneRol(email, "Revisor");
    const esAutor = tieneRol(email, "Autor");

    if (!usuario) {
      const folderId = inicializarCarpetaUsuario(email);
      registrarUsuario(email, name, folderId);
      return { esNuevo: true, folderId, nombre: name, esAdmin, esRevisor, esAutor };
    }

    return { esNuevo: false, folderId: usuario.folderId, esAdmin, esRevisor, esAutor };

  } catch (err) {
    console.error(`Error crítico en inicializarUsuario: ${err.message}`);
    throw new Error("No se pudo iniciar la sesión del usuario.");
  }
}

/**
 * Busca un usuario en la base de datos por su correo electrónico.
 * @param {string} email - El correo electrónico a buscar.
 * @returns {Object|null} Objeto con datos del usuario o null si no se encuentra.
 */
function buscarUsuario(email) {
  const fila = findRowInSheet("Usuarios", 0, email);
  if (fila) {
    return {
      email:    fila[0],
      nombre:   fila[1],
      rol:      fila[2],
      folderId: fila[3]
    };
  }
  return null;
}

/**
 * Registra un nuevo usuario en la hoja de Usuarios.
 * @param {string} email - Correo electrónico del usuario.
 * @param {string} nombre - Nombre del usuario.
 * @param {string} folderId - ID de su carpeta de trabajo en Drive.
 * @returns {boolean} Siempre true tras añadir la fila.
 */
function registrarUsuario(email, nombre, folderId) {
  const ss = getSpreed();
  const sheet = ss.getSheetByName("Usuarios");
  sheet.appendRow([email, nombre, "Autor", folderId, new Date()]);
  return true;
}

/**
 * Obtiene la lista completa de usuarios registrados.
 * @returns {Array<Object>} Lista de usuarios con email, nombre y roles.
 */
function obtenerTodosUsuarios() {
  const data = getSheetData("Usuarios");
  return data.slice(1).map(row => ({
    email:  row[0],
    nombre: row[1],
    roles:  row[2] ? row[2].toString().split(",").map(r => r.trim()) : []
  }));
}

/**
 * Actualiza los roles de un usuario existente.
 * @param {string} email - Correo electrónico del usuario.
 * @param {Array<string>} roles - Lista de nuevos roles.
 * @returns {boolean} True si se actualizó, false si no se encontró el usuario.
 */
function actualizarRolesUsuario(email, roles) {
  const ss = getSpreed();
  const sheet = ss.getSheetByName("Usuarios");
  const data  = getSheetData("Usuarios");
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      sheet.getRange(i + 1, 3).setValue(roles.join(", "));
      return true;
    }
  }
  return false;
}