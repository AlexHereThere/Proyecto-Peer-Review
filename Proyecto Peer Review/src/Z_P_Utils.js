/**
 * Pruebas de Utilidades Transversales.
 */
function PU_Utils() {

  Qunit.module("PU_Utils: Normalización de Nombres");

  Qunit.test("limpiarNombre - Sanitización de strings", (assert) => {
    assert.equal(limpiarNombre("Juan Pérez"), "juan_perez", "Maneja espacios y acentos.");
    assert.equal(limpiarNombre("Archivo (Final) v1.pdf"), "archivo_final_v1pdf", "Remueve caracteres especiales.");
    assert.equal(limpiarNombre("  ESTUDIANTE  "), "estudiante", "Limpia espacios en los extremos.");
    assert.equal(limpiarNombre(null), "usuario_sin_nombre", "Maneja valores nulos.");
  });

  Qunit.module("PU_Utils: Correlativos y Archivos");

  Qunit.test("calcularSiguienteCorrelativo - Formatos R#_V#", (assert) => {
    const idCarpetaSimulada = REGISTRO_PRUEBAS.carpetas.values().next().value;
    if (!idCarpetaSimulada) {
      assert.ok(true, "Saltando test por falta de carpeta de prueba.");
      return;
    }

    const nombreV1 = "V1_Test_Doc";
    // Si la carpeta está vacía, el siguiente es 1
    const next = calcularSiguienteCorrelativo(idCarpetaSimulada, nombreV1);
    assert.equal(next, 1, "Retorna 1 para carpeta vacía.");
  });
}
