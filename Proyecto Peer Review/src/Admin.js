function testAdmin() {
  Logger.log("esAdmin: " + verificarEsAdmin("omar.leal@uabc.edu.mx"));
  // CORREGIDO: El nombre correcto de la tabla según tu esquema es "Revisiones"
  const sheet = getSpreed().getSheetByName("Revisiones"); 
  Logger.log("Datos Revisiones: " + JSON.stringify(sheet.getDataRange().getValues()));
}

function obtenerRevisoresDelSistema() {
  const sheet = getSheet_USR();
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  return data.slice(1)
    .filter(row => {
      const roles = row[2] ? row[2].toString().split(",").map(r => r.trim()) : [];
      return roles.includes("Revisor");
    })
    .map(row => ({
      email:  row[0],
      nombre: row[1]
    }));
}

function getCopiarRevisores(idDocumento) {
  const sheet = getSheet_CON();
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  const fila = data.find(row => row[0] === idDocumento);
  return fila ? fila[1] : false;
}

function setCopiarRevisores(idDocumento, valor) {
  const sheet = getSheet_CON();
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  const idx  = data.findIndex(row => row[0] === idDocumento);
  if (idx >= 0) {
    sheet.getRange(idx + 1, 2).setValue(valor);
  } else {
    sheet.appendRow([idDocumento, valor]);
  }
}

// ==========================================
// MÓDULOS DE ADMINISTRACIÓN Y ADICIONES
// ==========================================

// MODIFICADO: Ahora recibe 'tipoRevision' como 4to parámetro desde el JS Frontend
function asignarRevisorDesdeAdmin(idRaiz, emailRevisor, folderRevId, tipoRevision) {
  // Asegurar un valor por defecto si por alguna razón llega vacío
  const tipo = tipoRevision || "Doble Ciego";

  const dataVer = getSheet_VER().getDataRange().getValues();
  const versiones = dataVer.slice(1).filter(row => row[0] === idRaiz).sort((a, b) => b[2] - a[2]);

  if (versiones.length === 0) throw new Error("No se encontraron versiones para este documento.");
  const idArchivoV = versiones[0][1];

  const yaAsignado = buscarRevisionExistente(idArchivoV, emailRevisor);
  if (yaAsignado) throw new Error("Este revisor ya está asignado a este documento.");

  // MODIFICADO: Se le pasa el 'tipo' a tu función encargada de hacer el appendRow en la hoja de Revisiones
  const resultado = asignarRevision(idArchivoV, emailRevisor, folderRevId, tipo);

  const filaDoc = getSheet_DOC().getDataRange().getValues().find(row => row[2] === idRaiz);
  const nombreDoc = filaDoc ? filaDoc[1] : "un documento";

  // INVOCACIÓN DEL MÓDULO DE EMAILS
  enviarNotificacion_AsignacionNueva(emailRevisor, nombreDoc, resultado.idR);

  // Forzar actualización maestro
  ejecutarActualizacionDeEstadoMaestro(idRaiz);

  return resultado;
}

// MODIFICADO: Hereda el tipo de revisión original que tenía el revisor en la V1
function copiarRevisoresV1AVersionActual(idRaiz, folderRevId) {
  const versiones = getSheet_VER().getDataRange().getValues().slice(1).filter(row => row[0] === idRaiz).sort((a, b) => a[2] - b[2]);

  if (versiones.length === 0) return { mensaje: "No hay versiones." };
  if (versiones.length === 1) return { mensaje: "Solo hay una versión, no hay nada que copiar." };

  const idArchivoV1 = versiones[0][1];
  
  const datosRevisionesV1 = getSheet_REV().getDataRange().getValues().slice(1)
    .filter(row => row[0] === idArchivoV1)
    .map(row => ({
      email: row[3],
      tipoRevision: row[6] || "Doble Ciego" // Por si filas viejas no lo tienen
    }));

  if (datosRevisionesV1.length === 0) return { mensaje: "V1 no tiene revisores asignados." };

  const versionActual = versiones[versiones.length - 1];
  const idArchivoVActual = versionActual[1];
  const filaDoc = getSheet_DOC().getDataRange().getValues().find(r => r[2] === idRaiz);
  const nombreDoc = filaDoc ? filaDoc[1] : "un documento";

  let copiados = 0; let existentes = 0;

  datosRevisionesV1.forEach(rev => {
    try {
      if (buscarRevisionExistente(idArchivoVActual, rev.email)) { existentes++; return; }

      // MODIFICADO: Pasa el tipo de revisión que arrastra desde la V1
      const resultado = asignarRevision(idArchivoVActual, rev.email, folderRevId, rev.tipoRevision);
      
      // INVOCACIÓN DEL MÓDULO DE EMAILS
      enviarNotificacion_NuevaVersion(rev.email, nombreDoc, versionActual[2], resultado.idR);
      
      copiados++;
    } catch(e) { console.warn("No se pudo copiar revisor: " + rev.email); }
  });

  // Forzar actualización maestro
  ejecutarActualizacionDeEstadoMaestro(idRaiz);

  return { mensaje: `${copiados} revisor(es) copiados. ${existentes} ya asignados.` };
}

function quitarRevisorDeVersion(idArchivoR) {
  const sheetRev = getSheet_REV();
  const dataRev = sheetRev.getDataRange().getValues();
  const filaIndex = dataRev.findIndex(row => row[1] === idArchivoR);
  if (filaIndex <= 0) throw new Error("Revisión no encontrada.");

  const row = dataRev[filaIndex];
  const idRaiz = obtenerIdRaizDesdeVersion(row[0]);

  try {
    Drive.Permissions.list(idArchivoR).items.forEach(p => { if (p.role !== "owner") Drive.Permissions.remove(idArchivoR, p.id); });
  } catch(e) { console.warn("No se revocó en Drive: " + e.message); }

  sheetRev.deleteRow(filaIndex + 1);

  try { DriveApp.getFileById(idArchivoR).setTrashed(true); } catch(e) { console.warn("No se borró archivo."); }

  // Forzar actualización maestro tras la remoción
  ejecutarActualizacionDeEstadoMaestro(idRaiz);

  return true;
}