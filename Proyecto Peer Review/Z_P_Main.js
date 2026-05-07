/**
 * Pruebas de Infraestructura y Configuración Principal.
 * Verifica la conexión con la base de datos, la integridad de las pestañas
 * y la correcta carga de componentes de la interfaz.
 */
function PU_Main() {

  Qunit.module("PU_Main: Configuración y Spreadsheet");

  Qunit.test("Validar Propiedad SHEET_ID", (assert) => {
    const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    assert.ok(id, "El SHEET_ID debe estar definido en Script Properties.");
    assert.notEqual(id, "", "El SHEET_ID no debe estar vacío.");
  });

  Qunit.test("Acceso al Spreadsheet (getSpreed)", (assert) => {
    try {
      const ss = getSpreed();
      assert.ok(ss, "Debería poder abrir el Spreadsheet.");
      assert.equal(typeof ss.getId, 'function', "El objeto retornado es una instancia válida de Spreadsheet.");
    } catch (e) {
      assert.ok(false, `Error al abrir Spreadsheet: ${e.toString()}`);
    }
  });

  Qunit.module("PU_Main: Existencia de Hojas");

  const hojasATestear = [
    { nombre: "Usuarios", fn: getSheet_USR },
    { nombre: "Documentos", fn: getSheet_DOC },
    { nombre: "Versiones", fn: getSheet_VER },
    { nombre: "Revisiones", fn: getSheet_REV },
    { nombre: "Actividad", fn: getSheet_ACT }
  ];

  hojasATestear.forEach((item) => {
    Qunit.test(`Validar Hoja: ${item.nombre}`, (assert) => {
      const sheet = item.fn();
      assert.ok(sheet !== null, `La instancia de la hoja '${item.nombre}' debería existir.`);
      if (sheet) {
        assert.equal(sheet.getName(), item.nombre, `El nombre en la pestaña coincide exactamente con '${item.nombre}'.`);
      }
    });
  });

  Qunit.module("PU_Main: Estructura de Cabeceras");

  const esquema = [
    { nombre: "Usuarios", cabeceras: ["Email_Usuario", "Nombre_Usuario", "Roles", "ID_G_Carpeta", "Fecha_Registro"] },
    { nombre: "Documentos", cabeceras: ["Fecha", "Nombre_Archivo", "ID_Documento_Raiz", "ID_G_Trabajo", "ID_G_Versiones", "ID_G_Revisiones", "Estado", "Email_Autor"] },
    { nombre: "Versiones", cabeceras: ["ID_Documento_Raiz", "ID_Archivo_V", "Numero_Version", "Nombre_Archivo_V", "Fecha_Subida"] },
    { nombre: "Revisiones", cabeceras: ["ID_Archivo_V", "ID_Archivo_R", "Numero_Revision", "Email_Revisor", "Estado", "Fecha"] },
    { nombre: "Actividad", cabeceras: ["ID_Actividad", "Email_Usuario", "Titulo_Doc", "Tipo_Evento", "Detalle_Display", "Clase_CSS", "Fecha", "Accion_Enlace"] }
  ];

  esquema.forEach((tabla) => {
    Qunit.test(`Esquema de Tabla: ${tabla.nombre}`, (assert) => {
      const hoja = getSheetByName(tabla.nombre);
      assert.ok(hoja !== null, `La hoja '${tabla.nombre}' debe ser accesible.`);

      if (hoja) {
        const numColumnas = tabla.cabeceras.length;
        const cabecerasReales = hoja.getRange(1, 1, 1, numColumnas).getValues()[0];
        assert.deepEqual(cabecerasReales, tabla.cabeceras, "El orden y nombre de las columnas es correcto según el estándar.");
      }
    });
  });

  Qunit.module("PU_Main: Utilidades HTML/Interfaz");

  Qunit.test("Verificar inclusión de archivos (include)", (assert) => {
    try {
      const contenido = include('index');
      assert.ok(contenido.length > 0, "La función include() retorna contenido HTML/JS.");
    } catch (e) {
      assert.ok(false, `Fallo en include(): ${e.toString()}`);
    }
  });

  Qunit.test("Carga dinámica de vistas (getVista)", (assert) => {
    try {
      const html = getVista('index'); 
      assert.ok(html.length > 0, "La función getVista() renderiza el componente correctamente.");
    } catch (e) {
      assert.ok(false, `Fallo en getVista(): ${e.toString()}`);
    }
  });
}