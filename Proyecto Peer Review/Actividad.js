/**
 * Dashboard.gs - Gestión de Estadísticas y Actividad del Usuario
 */

/**
 * Obtiene los datos consolidados para el dashboard, incluyendo perfil,
 * estadísticas de documentos y actividad reciente del usuario.
 * * @returns {Object} Objeto con perfil, estadísticas y lista de actividades.
 */
function getDashboardData() {
  const userEmail = Session.getActiveUser().getEmail();
  
  // Obtener Perfil 
  const userSheet = getSheet_USR();
  const userData = userSheet.getDataRange().getValues();
  const userRow = userData.find(row => row[0] === userEmail) || [userEmail, "Usuario Nuevo", "Autor"];

  // Obtener Estadísticas desde la tabla Documentos
  const docSheet = getSheet_DOC();
  const docs = docSheet.getDataRange().getValues();
  docs.shift(); 
  
  // Filtrado de documentos por usuario
  const misDocs = docs.filter(row => row[7] === userEmail); 
  
  // Mapeo de estados basado en la columna 'Estado' (índice 6)
  const stats = {
    revisados: misDocs.filter(r => r[6] === "Revisado").length,
    pendientes: misDocs.filter(r => r[6] === "Pendiente").length,
    terminados: misDocs.filter(r => r[6] === "Aprobado").length,
    corregir: misDocs.filter(r => r[6] === "A Corregir").length,
    total: misDocs.length
  };

  // Obtener Actividad Reciente
  const actividades = getRecentActivity();

  return {
    perfil: {
      nombre: userRow[1],
      email: userEmail,
      rol: userRow[2]
    },
    stats: stats,
    recientes: actividades
  };
}

/**
 * Registra una nueva entrada de actividad en la hoja correspondiente.
 * * @param {string} titulo - El título de la actividad.
 * @param {string} tipo - El tipo de categoría de la acción.
 * @param {string} detalle - Descripción detallada de lo ocurrido.
 * @param {string} claseCSS - Nombre de la clase CSS para el estilo en la UI.
 * @param {string} accion_enlace - URL o identificador de la acción asociada.
 */
function registrarActividad(titulo, tipo, detalle, claseCSS, accion_enlace) {
  const sheet = getSheet_ACT();
  if (!sheet) return;

  const email = Session.getActiveUser().getEmail();
  const fecha = new Date();
  
  const payload = [
    "ACT-" + fecha.getTime(), 
    email, 
    titulo, 
    tipo, 
    detalle, 
    claseCSS, 
    fecha, 
    accion_enlace
  ];

  sheet.appendRow(payload);
}

/**
 * Obtiene las últimas 5 actividades del usuario actual, formateando la fecha
 * según la zona horaria del script.
 * * @returns {Array<Object>} Lista de objetos de actividad con formato para la interfaz.
 */
function getRecentActivity() {
  const userEmail = Session.getActiveUser().getEmail();
  const sheet = getSheet_ACT();
  
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  data.shift(); 

  return data
    .filter(row => row[1] === userEmail) 
    .reverse()                           
    .slice(0, 5)                         
    .map(row => ({
      titulo: row[2],
      descripcion: row[4],
      colorClass: row[5],
      fecha: Utilities.formatDate(new Date(row[6]), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
      accion: row[7]
    }));
}

/**
 * Inactiva enlaces de actividad específicos de un documento cuando este es eliminado.
 * Modifica el detalle del registro para indicar que el archivo ya no existe.
 * * @param {string} idDocumento - El ID del documento cuyos enlaces deben removerse.
 */
function limpiarEnlacesDeActividad(idDocumento) {
  try {
    const hojaActividad = getSheet_ACT(); 
    if (!hojaActividad || hojaActividad.getLastRow() < 2) return;

    const ultimaFila = hojaActividad.getLastRow();
    const rangoDetalles = hojaActividad.getRange(2, 5, ultimaFila - 1, 1);
    const rangoEnlaces = hojaActividad.getRange(2, 8, ultimaFila - 1, 1);
    
    const detalles = rangoDetalles.getValues();
    const enlaces = rangoEnlaces.getValues();
    
    let huboCambios = false;

    for (let i = 0; i < enlaces.length; i++) {
      let valorEnlace = String(enlaces[i][0]);
      
      if (valorEnlace.includes(idDocumento)) {
        enlaces[i][0] = ""; 
        detalles[i][0] = "(Archivo eliminado) " + detalles[i][0]; 
        huboCambios = true;
      }
    }

    if (huboCambios) {
      rangoEnlaces.setValues(enlaces);
      rangoDetalles.setValues(detalles);
    }
  } catch (e) {
    console.error("Error limpiando actividad: " + e.toString());
  }
}