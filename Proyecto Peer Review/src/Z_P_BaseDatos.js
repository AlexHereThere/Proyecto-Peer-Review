/**
 * Pruebas de la Capa de Acceso a Datos (DAO).
 * Valida el sistema de caché, recuperación de datos y búsquedas optimizadas.
 */
function PU_BaseDatos() {

  Qunit.module("PU_BaseDatos: Sistema de Caché y Recuperación");

  Qunit.test("getSheetData - Funcionamiento y Caché", (assert) => {
    const nombreHoja = "Usuarios";
    
    // 1. Primera llamada (petición real a Sheets)
    const inicio1 = Date.now();
    const data1 = getSheetData(nombreHoja);
    const fin1 = Date.now();
    
    assert.ok(Array.isArray(data1), "Retornó un arreglo de datos.");
    assert.ok(data1.length > 0, "La hoja Usuarios no está vacía.");

    // 2. Segunda llamada (debería venir de caché)
    const inicio2 = Date.now();
    const data2 = getSheetData(nombreHoja);
    const fin2 = Date.now();

    assert.deepEqual(data1, data2, "Los datos de la caché coinciden con los originales.");
    
    // Nota: Date.now() puede variar, pero la caché debería ser drásticamente más rápida
    // Solo como debug, no assert estricto por variabilidad de red
    console.log(`[Test] Latencia 1 (Real): ${fin1 - inicio1}ms | Latencia 2 (Caché): ${fin2 - inicio2}ms`);
  });

  Qunit.module("PU_BaseDatos: Búsquedas Optimizadas");

  Qunit.test("findRowInSheet - Búsqueda por valor", (assert) => {
    const emailTest = "omar.leal@uabc.edu.mx";
    const fila = findRowInSheet("Usuarios", 0, emailTest);
    
    assert.ok(fila !== null, "Encontró la fila del usuario admin.");
    if (fila) {
      assert.equal(fila[0], emailTest, "El email en la fila coincide.");
      assert.equal(fila[1], "Omar Leal", "El nombre en la fila coincide.");
    }

    const filaInexistente = findRowInSheet("Usuarios", 0, "no.existe@uabc.mx");
    assert.equal(filaInexistente, null, "Retorna null para valores no encontrados.");
  });

  Qunit.test("filterRowsInSheet - Filtrado por columna", (assert) => {
    // Simulamos un ID de documento raíz
    const idSimulado = "ID_SIMULADO_TEST";
    const sheet = getSheet_VER();
    
    // SETUP TEMPORAL
    sheet.appendRow([idSimulado, "VER_1", 1, "Archivo 1", new Date()]);
    sheet.appendRow([idSimulado, "VER_2", 2, "Archivo 2", new Date()]);
    
    // IMPORTANTE: Limpiar caché para que vea los nuevos datos si ya se había leído
    delete _CACHE_DATOS["Versiones"];

    const filas = filterRowsInSheet("Versiones", 0, idSimulado);
    assert.equal(filas.length, 2, "Encontró exactamente las 2 versiones simuladas.");
    assert.equal(filas[0][1], "VER_1", "La primera versión es correcta.");
    
    // CLEANUP
    const lastRow = sheet.getLastRow();
    sheet.deleteRow(lastRow);
    sheet.deleteRow(lastRow - 1);
  });

  Qunit.module("PU_BaseDatos: Utilidades de Estructura");

  Qunit.test("asegurarHoja - Integridad de creación", (assert) => {
    const ss = getSpreed();
    const nombreTest = "Hoja_BD_Test";
    const cabs = ["A", "B", "C"];
    
    const previa = ss.getSheetByName(nombreTest);
    if (previa) ss.deleteSheet(previa);
    
    const hoja = asegurarHoja(ss, nombreTest, cabs);
    assert.ok(hoja !== null, "Hoja creada exitosamente.");
    assert.equal(hoja.getName(), nombreTest, "Nombre asignado correctamente.");
    
    const realCabs = hoja.getRange(1, 1, 1, 3).getValues()[0];
    assert.deepEqual(realCabs, cabs, "Cabeceras insertadas correctamente.");
    
    ss.deleteSheet(hoja);
  });
}
