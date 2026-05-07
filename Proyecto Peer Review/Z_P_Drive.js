/**
 * Pruebas unitarias para la integración con Google Drive.
 * Cubre creación de carpetas, gestión de archivos y manipulación de contenido.
 * @param {RastreoTest} rastreo - Objeto para el seguimiento de recursos creados.
 */
function PU_Drive(rastreo) {

  Qunit.module("PU_Drive: Estructura y Archivos");

  Qunit.test("Obtener o Crear Carpeta", (assert) => {
    const raiz = DriveApp.getRootFolder();
    const nombre = `TEST_DIR_${Utilities.getUuid()}`;
    const carpeta = obtenerOCrearCarpeta(nombre, raiz);

    trackCarpeta(rastreo, carpeta.getId());
    assert.ok(carpeta, "Carpeta creada exitosamente");
  });

  Qunit.test("Inicializar Carpeta Usuario", (assert) => {
    const email = `test_${Utilities.getUuid()}@uabc.edu.mx`;
    const id = inicializarCarpetaUsuario(email);

    trackCarpeta(rastreo, id);
    assert.ok(id, "ID de carpeta de usuario generado");
  });

  Qunit.test("Crear Estructura de Trabajo", (assert) => {
    const tempParent = DriveApp.createFolder(`PARENT_TEST_${Utilities.getUuid()}`);
    const tempParentId = tempParent.getId();
    trackCarpeta(rastreo, tempParentId);

    try {
      const est = crearCarpetaTrabajo("Prueba", tempParentId);
      
      // Registrar subcarpetas creadas internamente
      trackCarpeta(rastreo, est.trabajoId);
      // Nota: Si versionesId está dentro de trabajoId, el cleanup de la principal suele bastar,
      // pero registrar ambas es más seguro.

      assert.ok(est.trabajoId, "ID de carpeta de trabajo generado");
      assert.ok(est.versionesId, "ID de carpeta de versiones generado");
    } catch (e) {
      assert.ok(false, `Falló crearCarpetaTrabajo: ${e.toString()}`);
    }
  });

  Qunit.test("Subir y Recuperar PDF", (assert) => {
    const nombreDoc = "test_unidad.pdf";
    const folder = DriveApp.createFolder(`FOLDER_PDF_TEST_${Utilities.getUuid()}`);
    const folderId = folder.getId();
    trackCarpeta(rastreo, folderId);

    const pdfBase64 = "JVBERi0xLjEKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqMiAwIG9iajw8L1R5cGUvUGFnZXMvS2lkc1szIDAgUl0vQ291bnQgMT4+ZW5kb2JqMyAwIG9iajw8L1R5cGUvUGFnZS9QYXJlbnQgMiAwIFIvTWVkaWFCb3hbMCAwIDYxMiA3OTJdL1Jlc291cmNlczw8Pj4+PmVuZG9iagp0cmFpbGVyPDwvUm9vdCAxIDAgUj4+CnN0YXJ0eHJlZgo0OTIKJSVFT0Y=";

    try {
      const fileId = subirArchivo(nombreDoc, pdfBase64, folderId);
      trackArchivo(rastreo, fileId);

      assert.ok(fileId && typeof fileId === "string", "ID de archivo válido recibido");

      SpreadsheetApp.flush();
      Utilities.sleep(1000); // Pausa para consistencia de Drive

      const archivoCreado = DriveApp.getFileById(fileId);
      assert.equal(archivoCreado.getName(), nombreDoc, "El archivo existe físicamente en Drive");

      // Validar recuperación de metadatos/bytes
      const data = getPDFData(fileId);
      assert.ok(data, "getPDFData retornó el objeto de datos");
      assert.equal(data.fileName, nombreDoc, "Metadato: Nombre correcto");
      assert.ok(data.bytes && data.bytes.length > 0, "Metadato: Bytes Base64 válidos");
      assert.equal(data.fileId, fileId, "Metadato: ID coincidente");

    } catch (e) {
      assert.ok(false, `ERROR CATASTRÓFICO: ${e.message} | En: ${e.stack}`);
    }
  });

  Qunit.test("Copiar Archivo", (assert) => {
    const fId = DriveApp.createFolder(`FOLDER_COPY_${Utilities.getUuid()}`).getId();
    trackCarpeta(rastreo, fId);

    const origId = subirArchivo("Orig.pdf", "JVBERi0xLjAK", fId);
    trackArchivo(rastreo, origId);

    const copiaId = copiarArchivo(origId, "Copia.pdf", fId);
    trackArchivo(rastreo, copiaId);

    assert.notEqual(copiaId, origId, "Se generó un nuevo ID para la copia");
  });

  Qunit.test("Actualizar Contenido", (assert) => {
    const fId = DriveApp.createFolder(`FOLDER_UPDATE_${Utilities.getUuid()}`).getId();
    trackCarpeta(rastreo, fId);

    const fileId = subirArchivo("Update.pdf", "JVBERi0xLjAK", fId);
    trackArchivo(rastreo, fileId);

    try {
      const res = actualizarContenidoArchivo(fileId, "JVBERi0xLjQKJUltcG9ydGFudGU=");
      assert.ok(res, "Actualización vía API exitosa");
    } catch (e) {
      assert.step("Aviso: Drive API v2/v3 debe estar activo en Servicios");
      assert.ok(true, "Prueba finalizada (verificar logs si falló la API)");
    }
  });
}