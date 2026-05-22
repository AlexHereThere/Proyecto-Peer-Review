/**
 * Pruebas Unitarias para el Módulo de Administración.
 * @param {RastreoTest} rastreo - Objeto para seguimiento de limpieza.
 */
function PU_Admin(rastreo) {

  Qunit.module("PU_Admin: Configuración de Documentos");

  Qunit.test("Configuración CopiarRevisores", (assert) => {
    const idDoc = `DOC_CONFIG_${Utilities.getUuid()}`;
    
    setCopiarRevisores(idDoc, true);
    assert.equal(getCopiarRevisores(idDoc), true, "Se guardó y recuperó correctamente la opción true.");

    setCopiarRevisores(idDoc, false);
    assert.equal(getCopiarRevisores(idDoc), false, "Se actualizó correctamente a false.");

    // Cleanup manual (Configuración no tiene rastreo automático por email)
    const sheet = getSheet_CON();
    const data = sheet.getDataRange().getValues();
    const idx = data.findIndex(r => r[0] === idDoc);
    if (idx >= 1) sheet.deleteRow(idx + 1);
  });

  Qunit.module("PU_Admin: Gestión de Revisores");

  Qunit.test("obtenerRevisoresDelSistema", (assert) => {
    // SETUP: Asegurar al menos un revisor
    const emailRev = `revisor_admin_${Utilities.getUuid()}@uabc.edu.mx`;
    getSheet_USR().appendRow([emailRev, "Revisor Test", "Revisor", "folder", new Date()]);
    trackUsuario(rastreo, emailRev);

    const lista = obtenerRevisoresDelSistema();
    const encontrado = lista.find(r => r.email === emailRev);
    
    assert.ok(encontrado, "El usuario con rol Revisor aparece en la lista administrativa.");
    assert.equal(encontrado.nombre, "Revisor Test", "Nombre recuperado correctamente.");
  });

  Qunit.test("Asignación desde Admin", (assert) => {
    const idRaiz = `RAIZ_ADMIN_${Utilities.getUuid()}`;
    const idV1 = `FILE_V1_${Utilities.getUuid()}`;
    const emailRev = `rev_asignar_${Utilities.getUuid()}@uabc.edu.mx`;

    // SETUP
    getSheet_DOC().appendRow([new Date(), "Doc Admin", idRaiz, "T", "V", "R", "Pendiente", "autor@test.com"]);
    getSheet_VER().appendRow([idRaiz, idV1, 1, "V1_Doc", new Date()]);
    
    trackDoc(rastreo, idRaiz);
    trackVersion(rastreo, idRaiz);

    // EJECUCIÓN
    try {
      const res = asignarRevisorDesdeAdmin(idRaiz, emailRev, "FOLDER_REV_ID", "Simple Ciego");
      assert.ok(res.success, "Asignación reportada como exitosa.");
      trackRevision(rastreo, res.idR);

      // Verificación en BD
      const revData = findRowInSheet("Revisiones", 1, res.idR);
      assert.ok(revData, "Registro de revisión creado.");
      assert.equal(revData[6], "Simple Ciego", "Modalidad persistida correctamente.");
    } catch (e) {
      assert.ok(false, `Error en asignación: ${e.message}`);
    }
  });
}
