/**
 * Email.js - Servicio centralizado de mensajería y notificaciones.
 * Aísla las plantillas HTML del flujo lógico de la aplicación con diseño UABC.
 */

/**
 * Motor base para enviar notificaciones estandarizadas con diseño UABC.
 * @param {string} emailDestino - Correo del destinatario.
 * @param {string} asunto - Asunto del correo electrónico.
 * @param {string} titulo - Título principal dentro de la tarjeta HTML.
 * @param {string} mensajeCuerpo - Contenido HTML del mensaje.
 * @param {boolean} esInvitacion - Si es true muestra los botones Aceptar/Rechazar. Si es false muestra "Ir a EvaluaPares".
 * @param {string} urlAceptarOrApp - URL de acción de aceptar o URL base de la app.
 * @param {string} [urlRechazar] - URL de acción de rechazar (opcional si esInvitacion es false).
 * @private
 */
function enviarCorreoBase_UABC(emailDestino, asunto, titulo, mensajeCuerpo, esInvitacion, urlAceptarOrApp, urlRechazar) {
  
  // Renderizado condicional de la sección de botones en base a la variable esInvitacion
  let seccionBotones = "";
  
  if (esInvitacion) {
    seccionBotones = `
      <div style="text-align: center; margin: 35px 0;">
        <a href="${urlAceptarOrApp}" style="background-color: #00723f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-right: 12px; display: inline-block;">Aceptar</a>
        <a href="${urlRechazar}" style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Rechazar</a>
      </div>`;
  } else {
    seccionBotones = `
      <div style="text-align: center; margin: 35px 0;">
        <a href="${urlAceptarOrApp}" style="background-color: #00723f; color: white; padding: 12px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Ir a EvaluaPares</a>
      </div>`;
  }

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #00723f; padding: 25px; text-align: center;">
        <h2 style="color: white; margin: 0; font-size: 24px; letter-spacing: 0.5px;">EvaluaPares UABC</h2>
      </div>
      <div style="padding: 30px; background-color: #f9f9f9; color: #333; line-height: 1.6;">
        <h3 style="color: #00723f; margin-top: 0; font-size: 18px;">${titulo}</h3>
        ${mensajeCuerpo}
        
        ${seccionBotones}
        
        <p style="font-size: 12px; color: #777; margin-top: 25px; text-align: center; border-top: 1px solid #ddd; padding-top: 15px;">
          Este es un correo automático, por favor no respondas directamente a este mensaje.
        </p>
      </div>
    </div>`;

  GmailApp.sendEmail(emailDestino, asunto, "", { htmlBody: htmlBody });
}

/**
 * Envía una notificación cuando se asigna un revisor por primera vez. (Muestra Aceptar/Rechazar)
 * @param {string} emailRevisor - Correo del revisor.
 * @param {string} nombreDoc - Nombre del documento asignado.
 * @param {string} idRevision - ID de la revisión.
 */
function enviarNotificacion_AsignacionNueva(emailRevisor, nombreDoc, idRevision) {
  const urlApp = ScriptApp.getService().getUrl();
  const urlAceptar  = `${urlApp}?action=aceptar&id=${idRevision}`;
  const urlRechazar = `${urlApp}?action=rechazar&id=${idRevision}`;
  
  const cuerpo = `
    <p>Hola,</p>
    <p>El administrador del sistema te ha asignado como revisor para el siguiente documento:</p>
    <div style="background-color: #fff; padding: 12px; border-left: 4px solid #00723f; margin: 15px 0; font-weight: bold;">${nombreDoc}</div>
    <p>¿Aceptas evaluar esta propuesta?</p>`;
    
  enviarCorreoBase_UABC(
    emailRevisor, 
    "EvaluaPares UABC - Se te asignó una revisión", 
    "Se te asignó una revisión", 
    cuerpo, 
    true, // esInvitacion = true
    urlAceptar, 
    urlRechazar
  );
}

/**
 * Envía una notificación cuando se sube una nueva versión y requiere re-evaluación. (Muestra Aceptar/Rechazar)
 * @param {string} emailRevisor - Correo del revisor.
 * @param {string} nombreDoc - Nombre del documento.
 * @param {number} numeroVersion - El número de la nueva versión.
 * @param {string} idRevision - ID de la revisión.
 */
function enviarNotificacion_NuevaVersion(emailRevisor, nombreDoc, numeroVersion, idRevision) {
  const urlApp = ScriptApp.getService().getUrl();
  const urlAceptar  = `${urlApp}?action=aceptar&id=${idRevision}`;
  const urlRechazar = `${urlApp}?action=rechazar&id=${idRevision}`;
  
  const cuerpo = `
    <p>Hola,</p>
    <p>Una nueva versión corregida se encuentra disponible para el documento del cual eres par evaluador:</p>
    <div style="background-color: #fff; padding: 12px; border-left: 4px solid #ffc107; margin: 15px 0;">
      <strong>${nombreDoc}</strong> <span style="color:#777; font-size:13px;">(Versión ${numeroVersion})</span>
    </div>
    <p>¿Aceptas continuar con el proceso de revisión para esta nueva entrega?</p>`;

  enviarCorreoBase_UABC(
    emailRevisor, 
    "EvaluaPares UABC - Nueva versión de documento para revisar", 
    "Nueva versión disponible", 
    cuerpo, 
    true, // esInvitacion = true
    urlAceptar, 
    urlRechazar
  );
}

/**
 * Envía una notificación a todos los administradores cuando un revisor rechaza una asignación.
 * @param {string} emailRevisor - Correo del revisor que rechazó.
 * @param {string} nombreDoc - Nombre del documento en cuestión.
 */
function enviarNotificacion_RevisionRechazada(emailRevisor, nombreDoc) {
  const urlApp = ScriptApp.getService().getUrl();
  
  const cuerpo = `
    <p>El revisor <strong>${emailRevisor}</strong> ha <strong>rechazado</strong> la invitación para evaluar el siguiente documento:</p>
    <div style="background-color: #fff; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; font-weight: bold;">
      ${nombreDoc}
    </div>
    <p>Por favor, ingresa al panel de administración para reasignar un nuevo par evaluador.</p>`;

  getSheet_USR().getDataRange().getValues().slice(1)
    .filter(row => {
      const roles = row[2] ? row[2].toString().split(",").map(r => r.trim()) : [];
      return roles.includes("Admin");
    })
    .forEach(admin => {
      enviarCorreoBase_UABC(
        admin[0], 
        "EvaluaPares UABC - Revisión Rechazada", 
        "Alerta: Revisión Rechazada", 
        cuerpo, 
        false, // esInvitacion = false (Remueve aceptar/rechazar y genera botón único)
        urlApp  // Pasa el link de la app principal
      );
    });
}

/**
 * Envía un resumen personalizado de actividades del día actual a cada usuario.
 */
function enviarNotificacion_ResumenDiario() {
  const sheet = getSheet_ACT();
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return; // No hay registros transaccionales

  const data = sheet.getDataRange().getValues();
  data.shift(); // Remover fila de cabeceras

  const hoy = new Date();
  
  // Diccionario para almacenar las actividades de cada usuario { "email@uabc.mx": [ ...actividades ] }
  const actividadesPorUsuario = {};
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // 1. Clasificar y agrupar la actividad de hoy (Directo por el usuario registrado en la fila)
  for (let i = 0; i < data.length; i++) {
    const fechaActividad = new Date(data[i][6]);
    
    // Validar si la actividad ocurrió estrictamente hoy
    if (fechaActividad.getFullYear() === hoy.getFullYear() &&
        fechaActividad.getMonth() === hoy.getMonth() &&
        fechaActividad.getDate() === hoy.getDate()) {
      
      const usuarioAccion = data[i][1] ? data[i][1].toString().trim() : ""; 
      const tituloDoc = data[i][2];     // Título del documento afectado
      const tipoEvento = data[i][3];    // Tipo de evento ("Revisión", "Subida", etc.)
      
      // Filtro de seguridad: Si la columna colapsó con datos movidos, no rompe el script
      if (!emailRegex.test(usuarioAccion)) {
        console.warn(`Fila ${i + 2} omitida en Resumen Diario: '${usuarioAccion}' no es un correo válido.`);
        continue; 
      }

      if (!actividadesPorUsuario[usuarioAccion]) {
        actividadesPorUsuario[usuarioAccion] = [];
      }

      // Modificamos estéticamente el tipo si es una revisión para que el Autor lo entienda claro
      const tipoVisual = (tipoEvento.toLowerCase().includes("revis") || tipoEvento.toLowerCase().includes("evalua"))
        ? "Tu Trabajo fue Revisado" 
        : tipoEvento;

      actividadesPorUsuario[usuarioAccion].push({
        titulo: tituloDoc,
        tipo: tipoVisual,
        detalle: data[i][4],
        hora: Utilities.formatDate(fechaActividad, Session.getScriptTimeZone(), "HH:mm")
      });
    }
  }

  // 2. Detener la ejecución si nadie generó actividad en absoluto
  const usuariosConActividad = Object.keys(actividadesPorUsuario);
  if (usuariosConActividad.length === 0) {
    console.log("No se registró actividad válida en el sistema para ningún usuario el día de hoy.");
    return;
  }

  // 3. Obtener la lista total de Administradores para asegurar que "sepan todo lo que pasa"
  const listaAdmins = [];
  getSheet_USR().getDataRange().getValues().slice(1).forEach(row => {
    const roles = row[2] ? row[2].toString().split(",").map(r => r.trim()) : [];
    if (roles.includes("Admin")) {
      listaAdmins.push(row[0]);
    }
  });

  const urlApp = ScriptApp.getService().getUrl();
  const fechaAsunto = Utilities.formatDate(hoy, Session.getScriptTimeZone(), "dd/MM/yyyy");

  // 4. Procesar y enviar los correos correspondientes
  usuariosConActividad.forEach(emailDestinatario => {
    const esAdmin = listaAdmins.includes(emailDestinatario);
    let listaActividades = actividadesPorUsuario[emailDestinatario];

    // Si el usuario es Administrador, fusionamos el consolidado global de todo lo ocurrido
    if (esAdmin) {
      const todasLasActividadesDelDia = [];
      Object.keys(actividadesPorUsuario).forEach(usr => {
        actividadesPorUsuario[usr].forEach(act => {
          if (!todasLasActividadesDelDia.some(e => e.hora === act.hora && e.titulo === act.titulo && e.detalle === act.detalle)) {
            todasLasActividadesDelDia.push(act);
          }
        });
      });
      listaActividades = todasLasActividadesDelDia;
    }

    const cuerpoHtml = generarTablaActividadPersonalHtml(listaActividades, esAdmin);

    enviarCorreoBase_UABC(
      emailDestinatario, 
      `EvaluaPares UABC - Resumen de Actividad Diario [${fechaAsunto}]`, 
      esAdmin ? "Reporte Global de Actividad" : "Tu Actividad de Hoy", 
      cuerpoHtml, 
      false, 
      urlApp
    );
  });

  // 5. Asegurar envío a Administradores que no hayan tenido clics directos hoy
  listaAdmins.forEach(adminEmail => {
    if (!usuariosConActividad.includes(adminEmail)) {
      const todasLasActividadesDelDia = [];
      Object.keys(actividadesPorUsuario).forEach(usr => {
        actividadesPorUsuario[usr].forEach(act => {
          if (!todasLasActividadesDelDia.some(e => e.hora === act.hora && e.titulo === act.titulo && e.detalle === act.detalle)) {
            todasLasActividadesDelDia.push(act);
          }
        });
      });

      if (todasLasActividadesDelDia.length > 0) {
        const cuerpoHtml = generarTablaActividadPersonalHtml(todasLasActividadesDelDia, true);
        enviarCorreoBase_UABC(
          adminEmail, 
          `EvaluaPares UABC - Resumen de Actividad Diario (Global) [${fechaAsunto}]`, 
          "Reporte Global de Actividad", 
          cuerpoHtml, 
          false, 
          urlApp
        );
      }
    }
  });

  console.log(`Finalizado. Resúmenes distribuidos eficientemente.`);
}

/**
 * Genera una grilla de filas HTML personalizada para el usuario o administrador.
 * @param {Array<Object>} actividades - Lista de actividades a incluir en la tabla.
 * @param {boolean} esAdmin - Indica si el destinatario es administrador.
 * @returns {string} El contenido HTML de la tabla de actividades.
 */
function generarTablaActividadPersonalHtml(actividades, esAdmin) {
  let filas = "";
  
  // Ordenar cronológicamente por hora por si se mezclaron actividades
  actividades.sort((a, b) => a.hora.localeCompare(b.hora));

  actividades.forEach(act => {
    filas += `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px 4px; font-size: 12px; color: #666; vertical-align: top; width: 15%;">${act.hora}</td>
        <td style="padding: 10px 4px; font-size: 13px; vertical-align: top; width: 85%;">
          <span style="background-color: #e6f2ed; color: #00723f; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; display: inline-block; margin-bottom: 4px;">${act.tipo}</span>
          <br><span style="font-weight: bold; color: #111;">${act.titulo}</span>
          <br><span style="font-size: 12px; color: #555; display: block; margin-top: 2px;">${act.detalle}</span>
        </td>
      </tr>`;
  });

  const introduccion = esAdmin 
    ? `<p>Estimado Administrador,</p><p>Este es el reporte global consolidado con todos los movimientos y revisiones efectuadas en la plataforma durante el día de hoy:</p>`
    : `<p>Hola,</p><p>Este es el resumen automático de las acciones relevantes y actualizaciones registradas en tus trabajos o a tu nombre el día de hoy:</p>`;

  return `
    ${introduccion}
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; text-align: left;">
      <thead>
        <tr style="border-bottom: 2px solid #00723f; color: #00723f; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
          <th style="padding-bottom: 8px;">Hora</th>
          <th style="padding-bottom: 8px;">Evento / Detalle</th>
        </tr>
      </thead>
      <tbody>
        ${filas}
      </tbody>
    </table>
    <p style="margin-top: 20px;">Si necesitas ingresar al portal web para dar seguimiento, presiona el siguiente botón:</p>
  `;
}

/**
 * Procesa las acciones "aceptar" y "rechazar" embebidas en los correos electrónicos.
 * @param {Object} e - Objeto de evento de la solicitud GET (Google Apps Script).
 * @returns {GoogleAppsScript.HTML.HtmlOutput} La página HTML de respuesta.
 */
function manejarAccionCorreo(e) {
  const params = e && e.parameter ? e.parameter : (e || {});
  const action = params.action;
  const idR    = params.id;
  let titulo, mensaje, color;

  try {
    if (action === "aceptar") {
      cambiarEstadoRevision(idR, "Asignado");
      titulo  = "¡Revisión Aceptada!";
      mensaje = "Has aceptado la revisión. Entra a la app para comenzar.";
      color   = "#00723f";
    } else if (action === "rechazar") {
      cambiarEstadoRevision(idR, "Rechazado");
      titulo  = "Revisión Rechazada";
      mensaje = "Has rechazado la revisión. El administrador será notificado.";
      color   = "#dc3545";
    } else {
      titulo  = "Acción no reconocida";
      mensaje = "El enlace no es válido.";
      color   = "#6c757d";
    }
  } catch(err) {
    titulo  = "Error";
    mensaje = "No se pudo procesar la acción: " + err.message;
    color   = "#dc3545";
  }

  const urlApp = ScriptApp.getService().getUrl();

  return HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>EvaluaPares UABC</title>
      <style>
        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
        .card { background: white; border-radius: 10px; padding: 40px; max-width: 500px; width: 90%; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        h2 { color: ${color}; margin-bottom: 10px; }
        p { color: #555; }
        .btn { display: inline-block; margin-top: 20px; padding: 12px 30px; background: #00723f; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
        .logo { background: #00723f; color: white; padding: 15px; border-radius: 10px 10px 0 0; margin: -40px -40px 30px -40px; font-size: 20px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">EvaluaPares UABC</div>
        <h2>${titulo}</h2>
        <p>${mensaje}</p>
        <a href="${urlApp}" class="btn">Ir a EvaluaPares</a>
        <p style="color: #aaa; font-size: 11px; margin-top: 20px;">Universidad Autónoma de Baja California</p>
      </div>
    </body>
    </html>
  `).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}