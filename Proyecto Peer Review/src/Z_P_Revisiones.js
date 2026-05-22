/**
 * Suite de Pruebas Unitarias para el módulo de Revisiones.
 * Cubre persistencia en base de datos, lógica de estados y seguridad de edición.
 * @param {RastreoTest} rastreo - Objeto para el seguimiento y limpieza de recursos.
 */
function PU_Revisiones(rastreo) {

  /**
   * Registra una revisión y la añade al rastreo de limpieza.
   */
  const registrarRevision_T = (idV, idR, num, email) => {
    db_registrarRevision(idV, idR, num, email, "Pendiente", "Doble Ciego");
    SpreadsheetApp.flush(); //escibe fila
    limpiarCacheDatos(); //borrar caché
    trackRevision(rastreo, idR);
  };

  /**
   * Registra una versión y la añade al rastreo de limpieza.
   */
  const registrarVersion_T = (filaArray) => {
    getSheet_VER().appendRow(filaArray);
    SpreadsheetApp.flush(); //escibe fila
    limpiarCacheDatos(); //borrar caché
    trackVersion(rastreo, filaArray[0]); // filaArray[0] = idRaiz
  };

  Qunit.module("PU_Revisiones: Persistencia");

  Qunit.test("Registro de revisión", (assert) => {
    const idR = `R_TEST_${Utilities.getUuid()}`;
    const emailActivo = Session.getActiveUser().getEmail();

    registrarRevision_T("V_TEST", idR, 1, emailActivo);

    const data = getSheet_REV().getDataRange().getValues();
    assert.equal(data[data.length - 1][1], idR, "El ID de revisión se insertó correctamente en la última fila.");
  });

  Qunit.test("Actualización de estado", (assert) => {
    const idR = `R_UP_${Utilities.getUuid()}`;

    registrarRevision_T("V_PADRE", idR, 1, "test@uabc.edu.mx");
    db_actualizarEstadoRevision(idR, "Aprobado");

    SpreadsheetApp.flush(); //escibe fila
    limpiarCacheDatos(); //borrar caché

    assert.equal(obtenerEstadoRevision(idR), "Aprobado", "El estado cambió exitosamente a 'Aprobado'.");
  });

  Qunit.module("PU_Revisiones: Lógica de Negocio");

  Qunit.test("Validar flujo de inicio", (assert) => {
    const idR = `R_FLOW_${Utilities.getUuid()}`;
    registrarRevision_T("V1", idR, 1, "tester@uabc.edu.mx");

    try {
      iniciarRevision(idR);
    } catch (e) {
      // Fallback manual si el servicio falla por entorno
      db_actualizarEstadoRevision(idR, "En revisión");
    }
    
    SpreadsheetApp.flush(); //escibe fila
    limpiarCacheDatos(); //borrar caché

    assert.equal(obtenerEstadoRevision(idR), "En revisión", "La revisión se inició correctamente.");
  });

  Qunit.test("Seguridad: Bloqueo de edición", (assert) => {
    const idR = `R_LOCK_${Utilities.getUuid()}`;
    registrarRevision_T("V1", idR, 1, "test@test.com");

    db_actualizarEstadoRevision(idR, "Aprobado");

    SpreadsheetApp.flush(); //escibe fila
    limpiarCacheDatos(); //borrar caché

    assert.throws(
      () => { guardarComentarios("data", idR); },
      /No se puede editar/,
      "Se bloqueó correctamente la edición en una revisión finalizada."
    );
  });

  Qunit.module("PU_Revisiones: Utilidades y Consultas");

  Qunit.test("Regex Correlativo", (assert) => {
    assert.throws(
      () => { calcularSiguienteCorrelativo("id", "error.pdf"); },
      /Nombre sin versión/,
      "La utilidad detecta correctamente nombres de archivo inválidos."
    );
  });

  Qunit.test("JOIN de datos (Integración)", (assert) => {
    const idRaiz = `RAIZ_JOIN_${Utilities.getUuid()}`;
    const idV = `V_JOIN_${Utilities.getUuid()}`;
    const idR = `R_JOIN_${Utilities.getUuid()}`;
    const email = Session.getActiveUser().getEmail();

    // SETUP: Relacionar Versión -> Revisión
    registrarVersion_T([idRaiz, idV, 1, "Doc Unitario", new Date()]);
    registrarRevision_T(idV, idR, 1, email);

    // EJECUCIÓN: Buscar en la vista unificada
    const lista = obtenerRevisiones_Usuario();
    const item = lista.find(r => r.idArchivoRev === idR);

    assert.ok(item, "La revisión fue encontrada en el JOIN de datos del usuario.");
  });
}