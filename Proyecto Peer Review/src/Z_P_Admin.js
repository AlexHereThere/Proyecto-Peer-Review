/**
 * Pruebas Unitarias para el Módulo de Administración.
 * @param {RastreoTest} rastreo - Objeto para seguimiento de limpieza.
 */
function PU_Admin(rastreo) {

  Qunit.module("PU_Admin: Gestión de Revisores");

  Qunit.test("obtenerRevisoresDelSistema", (assert) => {
    // SETUP: Asegurar al menos un revisor
    const emailRev = `revisor_admin_${Utilities.getUuid()}@uabc.edu.mx`;
    getSheet_USR().appendRow([emailRev, "Revisor Test", "Revisor", "folder", new Date()]);
    SpreadsheetApp.flush(); //escibe fila
    limpiarCacheDatos(); //borrar caché

    trackUsuario(rastreo, emailRev);

    const lista = obtenerRevisoresDelSistema();
    const encontrado = lista.find(r => r.email === emailRev);
    
    assert.ok(encontrado, "El usuario con rol Revisor aparece en la lista administrativa.");
    assert.equal(encontrado.nombre, "Revisor Test", "Nombre recuperado correctamente.");
  });
  
  Qunit.test("Asignación desde Admin", (assert) => {
    const idRaiz = `RAIZ_ADMIN_${Utilities.getUuid()}`;
    const emailRev = Session.getActiveUser().getEmail();
    const nombreDocOriginal = "Doc Admin Test Ficticio";

    let archivoTemporal, carpetaTemporal;
    let idV1, folderRevId;

    try {

      archivoTemporal = DriveApp.createFile(`V1_${idRaiz}.txt`, "Contenido de la versión inicial del documento.");
      idV1 = archivoTemporal.getId();
      trackArchivo(rastreo, idV1); 

      carpetaTemporal = DriveApp.createFolder(`FOLDER_REV_${idRaiz}`);
      folderRevId = carpetaTemporal.getId();
      trackCarpeta(rastreo, folderRevId); 
      
    } catch (eDrive) {
      assert.ok(false, `Fallo crítico en el SETUP de Google Drive: ${eDrive.message}`);
      return; // Detiene el test si no se pudo preparar el entorno de Drive
    }

    getSheet_DOC().appendRow([new Date(), nombreDocOriginal, idRaiz, "T_ID", "V_ID", "R_ID", "Pendiente", "autor@test.com"]);
    getSheet_VER().appendRow([idRaiz, idV1, 1, nombreDocOriginal, new Date()]);
    SpreadsheetApp.flush();
    limpiarCacheDatos();
    
    trackDoc(rastreo, idRaiz);
    trackVersion(rastreo, idRaiz); 
    trackActividad(rastreo, nombreDocOriginal); 
    

    // EJECUCIÓN DEL MÉTODO A PROBAR
    try {
      const res = asignarRevisorDesdeAdmin(idRaiz, emailRev, folderRevId, "Simple Ciego");
      assert.ok(res && res.success, "Asignación reportada como exitosa por el backend.");
      
      if (res && res.idR) {
        trackRevision(rastreo, res.idR);
        trackArchivo(rastreo, res.idR);  
        SpreadsheetApp.flush();
        limpiarCacheDatos();

        const revData = findRowInSheet("Revisiones", 1, res.idR);
        assert.ok(revData, "El registro de la revisión fue localizado en la hoja 'Revisiones'.");
        
        if (revData) {
          assert.equal(revData[6], "Simple Ciego", "La modalidad de revisión ('Simple Ciego') persistió correctamente en la columna G.");
        }
      } else {
        assert.ok(false, "El método no devolvió un objeto de respuesta válido con un idR.");
      }

    } catch (e) {
      assert.ok(false, `Excepción atrapada durante la ejecución del test: ${e.message} \nStack: ${e.stack}`);
    }
  });
}
