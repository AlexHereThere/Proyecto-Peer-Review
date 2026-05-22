/**
 * Suite de Pruebas Unitarias para la Gestión de Versiones.
 * Valida el registro en DB, el flujo de subida incremental y la eliminación lógica/física.
 * @param {RastreoTest} rastreo - Objeto para el seguimiento y limpieza de recursos.
 */
function PU_Versiones(rastreo) {

  Qunit.module("PU_Versiones: Registro y Subida");

  Qunit.test("Registro simple en tabla Versiones", (assert) => {
    const idRaiz = `RAIZ_${Utilities.getUuid()}`;
    const folder = DriveApp.createFolder(`TEST_${Utilities.getUuid()}`);
    
    trackCarpeta(rastreo, folder.getId());

    const fileId = subirArchivo("V1_Prueba.pdf", "JVBERi0xLjAK", folder.getId());
    trackArchivo(rastreo, fileId);

    // Ejecución del registro en DB
    registrarVersion(idRaiz, fileId, 1, "V1_Prueba.pdf");
    trackVersion(rastreo, idRaiz);

    SpreadsheetApp.flush(); //escibe fila
    limpiarCacheDatos(); //borrar caché

    // Validación de persistencia
    const data = getSheet_VER().getDataRange().getValues();
    const fila = data.find(r => r[0] === idRaiz && r[1] === fileId && r[2] === 1);

    assert.ok(fila, "La versión fue correctamente registrada en la hoja de cálculo.");
  });

  Qunit.test("Flujo de Subida Nueva Versión", (assert) => {
    const idRaiz = `RAIZ_${Utilities.getUuid()}`;
    const folderTest = DriveApp.createFolder(`TEST_VERSIONADO_${Utilities.getUuid()}`);
    const versionesFolder = folderTest.createFolder("versiones");
    const vFolderId = versionesFolder.getId();

    // RASTREO DRIVE
    trackCarpeta(rastreo, folderTest.getId());
    trackCarpeta(rastreo, vFolderId);

    // SETUP: Simular existencia de documento raíz
    getSheet_DOC().appendRow([new Date(), "Documento_Prueba", idRaiz, folderTest.getId(), vFolderId, "REV_ID", "Pendiente", "USER_TEST"]);
    
    // RASTREO DB
    trackDoc(rastreo, idRaiz);
    trackVersion(rastreo, idRaiz);
    trackActividad(rastreo, "Documento_Prueba");

    const b64 = "JVBERi0xLjAK";

    // EJECUCIÓN: Subida incremental (V1 y V2)
    const res1 = subirNuevaVersionServidor(vFolderId, b64);
    if (res1.fileId) trackArchivo(rastreo, res1.fileId);

    const res2 = subirNuevaVersionServidor(vFolderId, b64);
    if (res2.fileId) trackArchivo(rastreo, res2.fileId);

    // ASSERTS
    assert.equal(res1.numero, 1, "El sistema identificó la primera subida como V1.");
    assert.equal(res2.numero, 2, "El sistema incrementó correctamente a V2.");
  });

  Qunit.module("PU_Versiones: Eliminación");

  Qunit.test("Borrado Parcial (Mantenimiento de Raíz)", (assert) => {
    const idRaiz = `RAIZ_PARCIAL_${Utilities.getUuid()}`;
    const folderTest = DriveApp.createFolder(`TEST_PARCIAL_${Utilities.getUuid()}`);
    const vFolder = folderTest.createFolder("versiones");
    const vFolderId = vFolder.getId();

    trackCarpeta(rastreo, folderTest.getId());
    trackCarpeta(rastreo, vFolderId);

    // SETUP
    getSheet_DOC().appendRow([new Date(), "Doc_Multi", idRaiz, folderTest.getId(), vFolderId, "REV_ID", "Pendiente", "U1"]);
    trackDoc(rastreo, idRaiz);
    trackVersion(rastreo, idRaiz);
    trackActividad(rastreo, "Doc_Multi");

    // Crear V1
    const file1Id = subirArchivo("V1_Doc.pdf", "JVBERi0xLjAK", vFolderId);
    trackArchivo(rastreo, file1Id);
    registrarVersion(idRaiz, file1Id, 1, "V1_Doc.pdf");

    // Crear V2
    const file2Id = subirArchivo("V2_Doc.pdf", "JVBERi0xLjAK", vFolderId);
    trackArchivo(rastreo, file2Id);
    registrarVersion(idRaiz, file2Id, 2, "V2_Doc.pdf");

    // EJECUCIÓN: Eliminar solo la V2
    const resultado = eliminarVersionServidor(vFolderId, 2);

    // ASSERTS
    assert.equal(resultado.eliminadoCompleto, false, "El documento raíz no se eliminó porque aún queda la V1.");
  });
}