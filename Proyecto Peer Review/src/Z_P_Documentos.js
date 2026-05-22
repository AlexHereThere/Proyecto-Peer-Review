/**
 * Pruebas unitarias para el núcleo integrador de documentos.
 * Incluye flujos de orquestación, consultas jerárquicas y búsquedas dinámicas.
 * * @param {RastreoTest} rastreo - Objeto para el seguimiento de recursos creados durante las pruebas.
 */
function PU_Documentos(rastreo) {

  Qunit.module("PU_Documentos: Flujo de Orquestación");

  Qunit.test("Orquestar Subida Original", (assert) => {
    const nombreDoc = "Test_Orquestado.pdf";
    const b64Fake = "JVBERi0xLjAKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqMiAwIG9iajw8L1R5cGUvUGFnZXMvS2lkc1szIDAgUl0vQ291bnQgMT4+ZW5kb2JqMyAwIG9iajw8L1R5cGUvUGFnZS9QYXJlbnQgMiAwIFIvTWVkaWFCb3hbMCAwIDYxMiA3OTJdL1Jlc291cmNlczw8Pj4+PmVuZG9iagp0cmFpbGVyPDwvUm9vdCAxIDAgUj4+CnN0YXJ0eHJlZgo0OTIKJSVFT0Y=";

    try {
      // PRE-CHECK
      const email = Session.getActiveUser().getEmail();
      const usuario = buscarUsuario(email);
      assert.ok(usuario, `Pre-check: El usuario ${email} existe.`);
      if (!usuario) return;

      // EJECUCIÓN
      const resultado = orquestarSubidaOriginal(nombreDoc, b64Fake);
      console.log("Resultado Orquestación:", JSON.stringify(resultado, null, 2));
      assert.equal(resultado, true, "La función orquestadora retornó true.");

      SpreadsheetApp.flush(); //escibe fila
      limpiarCacheDatos(); //borrar caché
      Utilities.sleep(500);

      SpreadsheetApp.flush(); //escibe fila
      limpiarCacheDatos(); //borrar caché
      const datosDoc = findRowInSheet("Documentos", 1, nombreDoc);
      assert.ok(datosDoc, "Documento localizado en BD por nombre.");
      
      if (datosDoc) {
        const idRaiz = datosDoc[2];
        trackDoc(rastreo, idRaiz);
        trackVersion(rastreo, idRaiz);
        trackActividad(rastreo, nombreDoc);
        assert.equal(datosDoc[1], nombreDoc, "Nombre del documento verificado.");
      }

    } catch (e) {
      assert.ok(false, `ERROR: ${e.message} | En: ${e.stack}`);
    }
  });

  Qunit.module("PU_Documentos: Consultas Relacionales");

  Qunit.test("Obtener Detalle Documento (Árbol Jerárquico)", (assert) => {
    const idRaizFake = `RAIZ_${Utilities.getUuid()}`;
    const verIdFake = `FILE_V1_${Utilities.getUuid()}`;
    const emailActivo = Session.getActiveUser().getEmail();

    // SETUP: Insertar datos de prueba manualmente
    getSheet_DOC().appendRow([new Date(), "Doc Jerárquico", idRaizFake, "T", "V", "R", "Pendiente", emailActivo]);
    getSheet_VER().appendRow([idRaizFake, verIdFake, 1, "V1_Doc Jerárquico", new Date()]);

    SpreadsheetApp.flush(); //escibe fila
    limpiarCacheDatos(); //borrar caché
  
    trackDoc(rastreo, idRaizFake);
    trackVersion(rastreo, idRaizFake);

    // EJECUCIÓN
    const detalle = obtenerDetalleDocumento(idRaizFake);

    // ASSERTS
    assert.ok(detalle, "Objeto de detalle recuperado.");
    assert.equal(detalle.nombre, "Doc Jerárquico", "Nombre coincidente.");
    assert.ok(Array.isArray(detalle.versiones), "Lista de versiones presente.");
    assert.equal(detalle.versiones[0].fileId, verIdFake, "Relación ID Raíz -> Versión correcta.");
  });

  Qunit.test("Buscar Datos por Folder (Columna Dinámica)", (assert) => {
    const idCarpeta = `FOLDER_${Utilities.getUuid()}`;
    const idRaiz = `RAIZ_${Utilities.getUuid()}`;

    // SETUP
    getSheet_DOC().appendRow([new Date(), "Doc Búsqueda", idRaiz, "T", idCarpeta, "R", "Pendiente", "test@uabc.mx"]);
    
    SpreadsheetApp.flush(); //escibe fila
   
    limpiarCacheDatos(); //borrar caché
    trackDoc(rastreo, idRaiz);

    // EJECUCIÓN
    const encontrado = buscarDocDatosPorFolder(idCarpeta, 4);

    // ASSERTS
    assert.ok(encontrado, "Documento localizado por folder.");
    assert.equal(encontrado.idOriginal, idRaiz, "ID Raíz verificado.");
    assert.equal(encontrado.nombre, "Doc Búsqueda", "Nombre verificado.");
  });
}