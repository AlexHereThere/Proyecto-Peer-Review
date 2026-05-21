/**
 * Dashboard.gs - Gestión de Estadísticas y Actividad del Usuario
 */

/**
 * Obtiene los datos consolidados y segmentados por rol para el dashboard.
 * @returns {Object} Perfil, estadísticas segmentadas por rol y lista de actividades.
 */
function getDashboardData() {
  const userEmail = Session.getActiveUser().getEmail();
  
  // 1. Obtener Perfil y Roles
  const userSheet = getSheet_USR();
  const userData = userSheet.getDataRange().getValues();
  const userRow = userData.find(row => row[0] === userEmail) || [userEmail, "Usuario Nuevo", "Autor"];
  
  const rolesString = userRow[2] || "Autor";
  const misRoles = rolesString.split(',').map(r => r.trim());

  // 2. Obtener datos maestros de Documentos y Revisiones
  const docSheet = getSheet_DOC();
  const docs = docSheet.getDataRange().getValues();
  docs.shift(); // Remover cabecera

  // Inicializar estructuras de estadísticas
  const stats = {
    esAutor: misRoles.includes("Autor"),
    esRevisor: misRoles.includes("Revisor"),
    esAdmin: misRoles.includes("Admin"),
    autor: { enRevision: 0, borradores: 0, aceptados: 0, porCorregir: 0 },
    revisor: { porEmpezar: 0, enProgreso: 0, completados: 0 },
    admin: { pentienteRevisor: 0, aprobados: 0, enRevision: 0, totalSistema: docs.length }
  };

  // --- MÉTRICAS DE AUTOR Y ADMIN (Un solo recorrido a la tabla Documentos) ---
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const estadoDoc = doc[6];  // Columna Estado
    const autorDoc = doc[7];   // Columna Email_Autor

    // Si el usuario es Autor de este documento, acumulamos sus métricas
    if (stats.esAutor && autorDoc === userEmail) {
      if (estadoDoc === "En Revisión") stats.autor.enRevision++;
      else if (estadoDoc === "Pendiente") stats.autor.borradores++;
      else if (estadoDoc === "Aprobado") stats.autor.aceptados++;
      else if (estadoDoc === "A Corregir") stats.autor.porCorregir++;
    }

    // Si el usuario es Admin, acumulamos métricas globales del sistema
    if (stats.esAdmin) {
      if (estadoDoc === "Pendiente") stats.admin.pentienteRevisor++;
      else if (estadoDoc === "Aprobado") stats.admin.aprobados++;
      else if (estadoDoc === "En Revisión") stats.admin.enRevision++;
    }
  }

  // --- MÉTRICAS DE REVISOR (Escaneo a la tabla Revisiones) ---
  if (stats.esRevisor) {
    const revSheet = getSheet_REV();
    if (revSheet) {
      const revisiones = revSheet.getDataRange().getValues();
      revisiones.shift(); // Remover cabecera
      
      for (let j = 0; j < revisiones.length; j++) {
        const rev = revisiones[j];
        const revisorEmail = rev[3]; // Columna Email_Revisor
        const estadoRev = rev[4];    // Columna Estado (de la revisión)

        if (revisorEmail === userEmail) {
          if (estadoRev === "Asignado") stats.revisor.porEmpezar++;
          else if (estadoRev === "En Revisión") stats.revisor.enProgreso++;
          else if (estadoRev === "A Corregir" || estadoRev === "Aprobado") stats.revisor.completados++;
        }
      }
    }
  }

  return {
    perfil: { nombre: userRow[1], email: userEmail, rol: rolesString },
    stats: stats,
    recientes: getRecentActivity()
  };
}

/**
 * Registra una nueva entrada de actividad en la hoja correspondiente a nombre del dueño del trabajo.
 * * @param {string} emailDueno - El correo electrónico del dueño del trabajo/propiedad.
 * @param {string} titulo - El título de la actividad.
 * @param {string} tipo - El tipo de categoría de la acción.
 * @param {string} detalle - Descripción detallada de lo ocurrido.
 * @param {string} claseCSS - Nombre de la clase CSS para el estilo en la UI.
 * @param {string} accion_enlace - URL o identificador de la acción asociada.
 */
function registrarActividad(emailDueno, titulo, tipo, detalle, claseCSS, accion_enlace) {
  const sheet = getSheet_ACT();
  if (!sheet) return;

  const fecha = new Date();
  
  const payload = [
    "ACT-" + fecha.getTime(), 
    emailDueno, 
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