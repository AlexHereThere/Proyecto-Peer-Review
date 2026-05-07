/**
 * User.gs - Utilidades de Texto, Identidad y Gestión de Sesión
 */

/**
 * Normaliza un nombre de usuario o archivo: elimina acentos, 
 * caracteres especiales y sustituye espacios por guiones bajos.
 * @param {string} nombre - El texto original a limpiar.
 * @return {string} - El texto normalizado.
 */
function limpiarNombre(nombre) {
  if (!nombre) return "usuario_sin_nombre";
  return nombre
    .normalize("NFD")               // Descompone caracteres con tilde
    .replace(/[\u0300-\u036f]/g, "") // Elimina las tildes
    .replace(/[^a-zA-Z0-9\s]/g, "") // Elimina símbolos especiales (evita errores en Drive)
    .replace(/\s+/g, "_")            // Espacios a guiones bajos
    .toLowerCase();                  // Todo a minúsculas
}

/**
 * Obtiene la información del perfil de Google del usuario activo.
 * @return {object} - Objeto con {id, name, email, photo}.
 */
function sacarGoogleInfoUsuario() {
  const email = Session.getActiveUser().getEmail();
  let name, photo, id;

  // Intento 1: People API
  try {
    const profile = People.People.get("people/me", {
      personFields: "names,photos"
    });
    name = profile.names?.[0]?.displayName;
    photo = profile.photos?.[0]?.url;
    id = profile.resourceName;
  } catch (e) {
    console.warn(`People API no disponible, usando fallback.`);
  }

  // Intento 2: Fallback vía OAuth2
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
  
  // Avatar por defecto si no hay foto
  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00723f&color=fff&size=200`;
  photo = photo || defaultAvatar;

  return { id, name, email, photo };
}

/**
 * Comprueba el registro del usuario. Si es nuevo, crea su carpeta y lo registra.
 * @return {object} - Datos de sesión inicial.
 */
function inicializarUsuario() {
  try {
    const { email, name } = sacarGoogleInfoUsuario();
    const usuario = buscarUsuario(email); 

    if (!usuario) {
      // Registro automático en el primer inicio de sesión
      const folderId = inicializarCarpetaUsuario(email); 
      registrarUsuario(email, name, folderId);     
      
      return { 
        esNuevo: true, 
        folderId,
        nombre: name 
      };
    }

    return { 
      esNuevo: false, 
      folderId: usuario.folderId 
    };

  } catch (err) {
    console.error(`Error crítico en inicializarUsuario: ${err.message}`);
    throw new Error("No se pudo iniciar la sesión del usuario.");
  }
}

/**
 * Recupera la información consolidada para el Dashboard.
 * Llama a la lógica de Dashboard.gs para mantener la integridad relacional.
 * @return {object} - Perfil, estadísticas y actividad reciente.
 */
function getUserDashboardData() {
  // Centralizamos la llamada para que las estadísticas siempre coincidan 
  // con la lógica de las nuevas tablas de Documentos y Versiones.
  return getDashboardData(); 
}

/**
 * Busca un usuario en la base de datos por su correo electrónico.
 * @param {string} email - Correo electrónico del usuario.
 * @returns {Object|null} Objeto con datos del usuario o null si no se encuentra.
 */
function buscarUsuario(email) {
  const sheet = getSheet_USR();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      return {
        email:    data[i][0],
        nombre:   data[i][1],
        rol:      data[i][2],
        folderId: data[i][3]
      };
    }
  }
  return null;
}

/**
 * Registra un nuevo usuario con el rol predeterminado de "Autor".
 * @param {string} email - Correo electrónico del usuario.
 * @param {string} nombre - Nombre completo del usuario.
 * @param {string} folderId - ID de la carpeta personal en Drive.
 * @returns {boolean} True al finalizar la inserción.
 */
function registrarUsuario(email, nombre, folderId) {
  const sheet = getSheet_USR();
  sheet.appendRow([email, nombre, "Autor", folderId, new Date()]);
  return true;
}