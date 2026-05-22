/**
 * Suite de Pruebas para Identidad y Gestión de Usuarios.
 * Valida la normalización de nombres, integración con Google Identity y persistencia en BD.
 * @param {RastreoTest} rastreo - Objeto para el seguimiento y limpieza de recursos.
 */
function PU_User(rastreo) {

  /**
   * Registra un usuario en la base de datos y lo añade al rastreo de limpieza.
   * @param {string} email - Email del usuario.
   * @param {string} nombre - Nombre completo.
   * @param {string} folderId - ID de su carpeta raíz en Drive.
   */
  const registrarUsuario_T = (email, nombre, folderId) => {
    registrarUsuario(email, nombre, folderId);
    SpreadsheetApp.flush();
    trackUsuario(rastreo, email);
  };

  Qunit.module("PU_User: Identidad de Google");

  Qunit.test("Sacar Info de Google (Sesión Actual)", (assert) => {
    const info = sacarGoogleInfoUsuario();
    
    assert.ok(info.email, `Email recuperado: ${info.email}`);
    assert.ok(info.name, `Nombre recuperado: ${info.name}`);
    assert.ok(info.photo.startsWith("http"), "Foto recuperada o generada (URL válida).");
  });

  Qunit.module("PU_User: Base de Datos y Sesión");

  Qunit.test("Buscar Usuario Inexistente", (assert) => {
    const emailFalso = `no_existo_${Utilities.getUuid()}@test.com`;
    const resultado = buscarUsuario(emailFalso);
    
    assert.equal(resultado, null, "Retorna null si el usuario no está en la base de datos.");
  });

  Qunit.test("Registro y Búsqueda de Usuario", (assert) => {
    const idTest = Utilities.getUuid().substring(0, 8);
    const emailTest = `test_${idTest}@uabc.edu.mx`;
    const nombreTest = `Usuario Test ${idTest}`;
    const folderIdTest = `folder_${idTest}`;

    // Ejecución con tracking
    registrarUsuario_T(emailTest, nombreTest, folderIdTest);

    // Verificación
    const encontrado = buscarUsuario(emailTest);
    assert.ok(encontrado, "El usuario fue localizado tras el registro.");
    assert.equal(encontrado.nombre, nombreTest, "El nombre coincide.");
    assert.equal(encontrado.rol, "Autor", "El rol predeterminado es 'Autor'.");
    assert.equal(encontrado.folderId, folderIdTest, "El Folder ID coincide.");
  });

  Qunit.test("Inicializar Usuario (Flujo Completo)", (assert) => {
    try {
      const sesion = inicializarUsuario();
      assert.ok(typeof sesion.esNuevo === 'boolean', "Se determinó correctamente el estado del usuario (nuevo/existente).");
      assert.ok(sesion.folderId, "Se retornó un Folder ID válido para la sesión de trabajo.");
    } catch (e) {
      assert.ok(false, `Error en inicializarUsuario: ${e.toString()}`);
    }
  });

  Qunit.test("Integridad de Dashboard Data", (assert) => {
    try {
      const data = getDashboardData();
      assert.ok(data, "La función retornó el objeto de datos del dashboard.");

      if (data) {
        assert.ok(data.hasOwnProperty("perfil"), "Estructura: llave 'perfil' verificada.");
        assert.ok(data.hasOwnProperty("stats"), "Estructura: llave 'stats' verificada.");
        assert.ok(Array.isArray(data.recientes), "Estructura: llave 'recientes' es un arreglo válido.");
      }
    } catch (e) {
      assert.ok(false, `Fallo en Dashboard.gs: ${e.message}`);
    }
  });
}