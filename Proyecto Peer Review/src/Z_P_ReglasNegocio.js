/**
 * Pruebas de Reglas de Negocio y Lógica de Decisión.
 * Valida el motor de estados y las reglas de anonimato.
 */
function PU_ReglasNegocio() {

  Qunit.module("PU_ReglasNegocio: Anonimato e Identidades");

  Qunit.test("obtenerIdentidadesVisibles - Escenarios de Privacidad", (assert) => {
    const autor = "autor@uabc.mx";
    const revisor = "revisor@uabc.mx";

    // ESCENARIO 1: Admin ve todo
    let res = obtenerIdentidadesVisibles("Doble Ciego", autor, revisor, "admin");
    assert.deepEqual(res, { autor, revisor }, "Admin siempre visualiza identidades reales.");

    // ESCENARIO 2: Modalidad Abierta
    res = obtenerIdentidadesVisibles("Abierta", autor, revisor, "autor");
    assert.deepEqual(res, { autor, revisor }, "En revisión abierta, el autor ve al revisor.");

    // ESCENARIO 3: Simple Ciego (Autor no ve revisor)
    res = obtenerIdentidadesVisibles("Simple Ciego", autor, revisor, "autor");
    assert.equal(res.revisor, "Anónimo (Revisor)", "En Simple Ciego, el autor NO ve al revisor.");
    assert.equal(res.autor, autor, "En Simple Ciego, el revisor sí ve al autor (implícito).");

    // ESCENARIO 4: Doble Ciego (Nadie ve a nadie)
    res = obtenerIdentidadesVisibles("Doble Ciego", autor, revisor, "autor");
    assert.equal(res.revisor, "Anónimo (Revisor)", "Doble Ciego: Autor ve al revisor como anónimo.");
    
    res = obtenerIdentidadesVisibles("Doble Ciego", autor, revisor, "revisor");
    assert.equal(res.autor, "Anónimo (Autor)", "Doble Ciego: Revisor ve al autor como anónimo.");
  });

  Qunit.module("PU_ReglasNegocio: Motor de Estados");

  Qunit.test("determinarEstadoDocumento - Lógica Inductiva", (assert) => {
    const idTest = `STATE_TEST_${Utilities.getUuid()}`;
    const idVer1 = `VER_1_${idTest}`;
    
    const sVer = getSheet_VER();
    const sRev = getSheet_REV();
    
    // SETUP: Limpiar caché para asegurar lectura de datos simulados
    delete _CACHE_DATOS["Versiones"];
    delete _CACHE_DATOS["Revisiones"];

    // CASO A: Solo versión subida, sin revisores
    sVer.appendRow([idTest, idVer1, 1, "V1 Test", new Date()]);
    assert.equal(determinarEstadoDocumento(idTest), "Pendiente", "Sin revisiones el estado es Pendiente.");

    // CASO B: Revisor asignado (Activo)
    sRev.appendRow([idVer1, "REV_1", 1, "rev@uabc.mx", "Asignado", new Date(), "Doble Ciego"]);
    delete _CACHE_DATOS["Revisiones"]; // Refrescar caché
    assert.equal(determinarEstadoDocumento(idTest), "En revisión", "Con revisión activa el estado es En revisión.");

    // CASO C: Una revisión aprobada, otra pendiente
    sRev.appendRow([idVer1, "REV_2", 2, "rev2@uabc.mx", "Aprobado", new Date(), "Doble Ciego"]);
    delete _CACHE_DATOS["Revisiones"];
    assert.equal(determinarEstadoDocumento(idTest), "En revisión", "Si falta alguna revisión, sigue En revisión.");

    // CASO D: Todas aprobadas
    // Cambiamos la REV_1 a Aprobado
    const dataRev = sRev.getDataRange().getValues();
    const filaRev1Idx = dataRev.findIndex(r => r[1] === "REV_1");
    sRev.getRange(filaRev1Idx + 1, 5).setValue("Aprobado");
    delete _CACHE_DATOS["Revisiones"];
    assert.equal(determinarEstadoDocumento(idTest), "Aprobado", "Si todas están aprobadas, el documento es Aprobado.");

    // CASO E: Una revisión solicita corrección
    sRev.getRange(filaRev1Idx + 1, 5).setValue("A Corregir");
    delete _CACHE_DATOS["Revisiones"];
    assert.equal(determinarEstadoDocumento(idTest), "A Corregir", "Si hay al menos una corrección, el estado es A Corregir.");

    // CLEANUP
    const lastV = sVer.getLastRow();
    const lastR = sRev.getLastRow();
    sVer.deleteRow(lastV);
    sRev.deleteRow(lastR);
    sRev.deleteRow(lastR - 1);
  });
}
