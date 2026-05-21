/**
 * User.gs - Utilidades de Texto, Identidad y Gestión de Sesión
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

function verificarEsAdmin(email) {
  try {
    const sheet = getSheet_USR();
    if (!sheet) return false;
    const data = sheet.getDataRange().getValues();
    const fila = data.find((row, i) => i > 0 && row[0] === email);
    if (!fila) return false;
    const roles = fila[2] ? fila[2].toString().split(",").map(r => r.trim()) : [];
    return roles.includes("Admin");
  } catch(e) {
    console.error("Error en verificarEsAdmin: " + e.message);
    return false;
  }
}

function tieneRol(email, rol) {
  try {
    const sheet = getSheet_USR();
    if (!sheet) return false;
    const data = sheet.getDataRange().getValues();
    const fila = data.find((row, i) => i > 0 && row[0] === email);
    if (!fila) return false;
    const roles = fila[2] ? fila[2].toString().split(",").map(r => r.trim()) : [];
    return roles.includes(rol);
  } catch(e) {
    console.error("Error en tieneRol: " + e.message);
    return false;
  }
}

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

function getUserDashboardData() {
  return getDashboardData();
}

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

function registrarUsuario(email, nombre, folderId) {
  const sheet = getSheet_USR();
  sheet.appendRow([email, nombre, "Autor", folderId, new Date()]);
  return true;
}

function obtenerTodosUsuarios() {
  const sheet = getSheet_USR();
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  return data.slice(1).map(row => ({
    email:  row[0],
    nombre: row[1],
    roles:  row[2] ? row[2].toString().split(",").map(r => r.trim()) : []
  }));
}

function actualizarRolesUsuario(email, roles) {
  const sheet = getSheet_USR();
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      sheet.getRange(i + 1, 3).setValue(roles.join(", "));
      return true;
    }
  }
  return false;
}