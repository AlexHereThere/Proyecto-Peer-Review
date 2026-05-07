/**
 * Pruebas de Lógica de Negocio: Inicialización y Estructura.
 * Valida la creación de la base de datos (Spreadsheet) y la integridad de las hojas.
 */
function PU_LogicaNegocio() {

  Qunit.module("PU_LogicaNegocio: Inicialización del Sistema");

  Qunit.test("inicializarSistema - Recuperación y Creación", (assert) => {
    // 1. EJECUCIÓN
    const id = inicializarSistema();
    
    // 2. ASSERTS DE IDENTIDAD
    assert.ok(id && id.length > 10, "Retornó un ID de Spreadsheet válido.");
    
    const file = DriveApp.getFileById(id);
    assert.equal(file.getName(), "Datos del Sistema", "El archivo en Drive tiene el nombre correcto.");
    
    // 3. ASSERTS DE CONFIGURACIÓN
    const propId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    assert.equal(propId, id, "El ID se persistió correctamente en ScriptProperties.");
  });

  Qunit.test("asegurarHoja - Creación de pestañas", (assert) => {
    const ss = getSpreed();
    const nombreTest = "Hoja_Prueba_Temporal";
    const cabs = ["Col1", "Col2"];
    
    // SETUP: Limpiar si existe previamente
    const previa = ss.getSheetByName(nombreTest);
    if (previa) ss.deleteSheet(previa);
    
    // EJECUCIÓN
    const hoja = asegurarHoja(ss, nombreTest, cabs);
    
    // ASSERTS
    assert.ok(hoja !== null, "La función retornó la instancia de la hoja.");
    assert.equal(hoja.getName(), nombreTest, "El nombre de la pestaña es correcto.");
    
    const cabecerasReales = hoja.getRange(1, 1, 1, 2).getValues()[0];
    assert.deepEqual(cabecerasReales, cabs, "Las cabeceras coinciden con el esquema definido.");
    
    // CLEANUP LOCAL
    ss.deleteSheet(hoja);
  });
}

/**
 * Pruebas de Integridad Relacional.
 * Valida que las eliminaciones y actualizaciones se propaguen correctamente entre tablas.
 */
function PU_Relacional() {
  const Qunit = QUnitGS2.QUnit;

  Qunit.module("PU_LogicaNegocio: Integridad Relacional");

  Qunit.test("eliminarRegistrosRelacionados - Cascada completa", (assert) => {
    const idRaizSimulado = `TEST_RAIZ_${Utilities.getUuid()}`;
    const idVersionSimulada = `TEST_VER_${Utilities.getUuid()}`;
    
    // 1. SETUP: Preparación de datos vinculados
    const sDoc = getSheet_DOC();
    const sVer = getSheet_VER();
    const sRev = getSheet_REV();
    
    sDoc.appendRow([new Date(), "Doc Prueba", idRaizSimulado, "", "", "", "Activo", "test@uabc.mx"]);
    sVer.appendRow([idRaizSimulado, idVersionSimulada, 1, "Archivo V1", new Date()]);
    sRev.appendRow([idVersionSimulada, "REV_1", 1, "revisor@uabc.mx", "Pendiente", new Date()]);

    SpreadsheetApp.flush();

    // 2. EJECUCIÓN
    const resultado = eliminarRegistrosRelacionados(idRaizSimulado);
    assert.ok(resultado === true, "La función reportó éxito (true).");

    // 3. VERIFICACIÓN: Cascada de eliminación
    const dataDoc = sDoc.getDataRange().getValues();
    const existeEnDoc = dataDoc.some(f => f[2] === idRaizSimulado);
    assert.notOk(existeEnDoc, "Registro maestro en 'Documentos' eliminado.");

    const dataVer = sVer.getDataRange().getValues();
    const existeEnVer = dataVer.some(f => f[0] === idRaizSimulado);
    assert.notOk(existeEnVer, "Registros vinculados en 'Versiones' eliminados.");

    const dataRev = sRev.getDataRange().getValues();
    const existeEnRev = dataRev.some(f => f[0] === idVersionSimulada);
    assert.notOk(existeEnRev, "Registros vinculados en 'Revisiones' eliminados.");
  });
}