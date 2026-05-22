/**
 * ReglasNegocio.js - Motores de Lógica y Reglas de Decisión
 * Contiene la lógica pura que determina el comportamiento del sistema.
 */

/**
 * Determina el estado de un documento analizando inductivamente sus versiones y revisiones.
 * @param {string} idArchivo - ID del archivo o ID raíz del documento.
 * @returns {string} El estado calculado ("Pendiente", "En revisión", "A Corregir", "Aprobado").
 */
function determinarEstadoDocumento(idArchivo) {
  let idRaiz = idArchivo;
  
  try {
    const dataVer = getSheetData("Versiones");
    const esIdVersion = dataVer.some(row => row[1] === idArchivo);
    if (esIdVersion) {
      idRaiz = obtenerIdRaizDesdeVersion(idArchivo);
    }
  } catch (e) {
    console.warn("Tratando parámetro como ID raíz directo.");
  }

  const datosVersiones = getSheetData("Versiones");
  const datosRevisiones = getSheetData("Revisiones");
  
  const cabecerasV = datosVersiones[0] || [];
  const filasVersiones = datosVersiones.slice(1);
  
  const idxIdDocRaiz = cabecerasV.indexOf("ID_Documento_Raiz");
  const idxIdArchivoV = cabecerasV.indexOf("ID_Archivo_V");
  const idxNumVersion = cabecerasV.indexOf("Numero_Version");
  
  const versionesDelDoc = filasVersiones.filter(fila => fila[idxIdDocRaiz] === idRaiz);
  if (versionesDelDoc.length === 0) return "Pendiente";
  
  const versionMasNueva = versionesDelDoc.reduce((max, actual) => 
    actual[idxNumVersion] > max[idxNumVersion] ? actual : max
  , versionesDelDoc[0]);
  
  const idVersionMasNueva = versionMasNueva[idxIdArchivoV];
  const todosIdsVersiones = new Set(versionesDelDoc.map(v => v[idxIdArchivoV]));

  const cabecerasR = datosRevisiones[0] || [];
  const filasRevisiones = datosRevisiones.slice(1);
  
  const idxIdArchivoV_R = cabecerasR.indexOf("ID_Archivo_V");
  const idxEstadoR = cabecerasR.indexOf("Estado");
  
  const revisionesDeCualquierVersion = [];
  const revisionesVersionMasNueva = [];
  
  filasRevisiones.forEach(fila => {
    const idArchV = fila[idxIdArchivoV_R];
    if (todosIdsVersiones.has(idArchV)) {
      revisionesDeCualquierVersion.push(fila);
      if (idArchV === idVersionMasNueva) {
        revisionesVersionMasNueva.push(fila);
      }
    }
  });

  // --- REGLAS DE NEGOCIO ---

  // REGLA 1: Si hay revisiones en proceso ("Asignado", "En revisión") en CUALQUIER versión.
  const tieneRevisionActiva = revisionesDeCualquierVersion.some(fila => {
    const est = String(fila[idxEstadoR]).trim().toLowerCase();
    return est === "asignado" || est === "en revisión" || est === "en revision" || est === "nuevo";
  });
  if (tieneRevisionActiva) return "En revisión";

  // REGLA 2: Si una revisión de la versión actual solicita corrección.
  const tieneCorrecionEnNueva = revisionesVersionMasNueva.some(fila => {
    return String(fila[idxEstadoR]).trim().toLowerCase() === "a corregir";
  });
  if (tieneCorrecionEnNueva) return "A Corregir";

  // REGLA 3: Si la versión actual ya cuenta con todas sus revisiones aprobadas formalmente.
  if (revisionesVersionMasNueva.length > 0) {
    const todasAprobadas = revisionesVersionMasNueva.every(fila => {
      return String(fila[idxEstadoR]).trim().toLowerCase() === "aprobado";
    });
    if (todasAprobadas) return "Aprobado";
  }

  return "Pendiente";
}

/**
 * Aplica las reglas de anonimato para revisiones (Abierta, Simple Ciego, Doble Ciego).
 * @param {string} tipoRevision - Tipo de revisión.
 * @param {string} emailAutor - Correo del autor.
 * @param {string} emailRevisor - Correo del revisor.
 * @param {string} rolUsuarioActual - Rol del usuario que consulta ("admin", "autor", "revisor").
 * @returns {Object} Objeto con identidades (autor y revisor) que deben mostrarse.
 */
function obtenerIdentidadesVisibles(tipoRevision, emailAutor, emailRevisor, rolUsuarioActual) {
  const rol = rolUsuarioActual ? rolUsuarioActual.trim().toLowerCase() : "";
  const tipo = tipoRevision ? tipoRevision.trim().toLowerCase() : "";

  if (rol === "admin") {
    return { autor: emailAutor, revisor: emailRevisor };
  }

  let autorVisible = emailAutor;
  let revisorVisible = emailRevisor;

  switch (tipo) {
    case "simple ciego":
      if (rol === "autor") {
        revisorVisible = "Anónimo (Revisor)";
      }
      break;

    case "doble ciego":
      if (rol === "autor") {
        revisorVisible = "Anónimo (Revisor)";
      } else if (rol === "revisor") { 
        autorVisible = "Anónimo (Autor)";
      }
      break;

    case "abierta":
    default:
      break;
  }

  return { autor: autorVisible, revisor: revisorVisible };
}
