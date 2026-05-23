import { test, expect } from './fixtures';
import path from 'path';

test('Navegación con usuario autor universal', async ({ page }) => {
  await page.goto('');

  // Localización del Frame principal (anidado)
  const frame = page
    .locator('iframe[title="Evaluapares UABC"]').contentFrame()
    .locator('iframe[title="Evaluapares UABC"]').contentFrame();

  // Funciones auxiliares reutilizables
  const expectHeading = async (text) => {
    await expect(frame.getByRole('heading', { name: new RegExp(text, 'i') })).toBeVisible();
  };

  const waitContenido = async () => {
    await frame.locator('#contenido').waitFor();
  };

  // 1. Esperar contenedor principal y verificar Inicio
  await waitContenido();
  await expect(frame.locator('#usernameHome')).toBeVisible();
  await expectHeading('Bienvenido');

  // 2. Navegación a Mi cuenta
  await frame.getByRole('button', { name: 'Mi cuenta' }).click();
  await waitContenido();

  // Validaciones generales en Mi cuenta
  await expect(frame.locator('#contenido')).toContainText('Datos de Usuario');
  await expect(frame.locator('#contenido')).toContainText('Autor');
  await expect(frame.locator('#u-nombre')).toBeVisible();
  await expect(frame.locator('#u-nombre')).not.toBeEmpty();
  await expect(frame.getByText(/@uabc\.edu\.mx/i)).toBeVisible();

  // 3. Navegación a Mis Documentos
  await frame.getByRole('button', { name: 'Mis Documentos' }).click();
  await waitContenido();
  
  await expectHeading('Mis Documentos');
  await expect(frame.locator('#contenido')).toContainText('Mis Documentos');

  // 4. Navegación Condicional: Sobre Nosotros
  const sobreNosotrosBtn = frame.getByRole('button', { name: /Sobre Nosotros/i });
  if (await sobreNosotrosBtn.isVisible()) {
    await sobreNosotrosBtn.click();
    await waitContenido();
    await expect(frame.locator('#contenido')).toContainText('¿Qué es Evaluapares?');
  }

  // 5. Navegación Condicional: Volver al Inicio
  const inicioBtn = frame.getByRole('button', { name: /Inicio/i });
  if (await inicioBtn.isVisible()) {
    await inicioBtn.click();
    await waitContenido();
    await expect(frame.locator('#usernameHome')).toBeVisible();
  }
});

test('Flujo documento: subir, ver detalles y eliminar documento', async ({ page }) => {
  // 1. Navegación e inicialización del Frame anidado
  await page.goto('');

  const frame = page
    .locator('iframe[title="Evaluapares UABC"]').contentFrame()
    .locator('iframe[title="Evaluapares UABC"]').contentFrame();

  const waitContenido = async () => await frame.locator('#contenido').waitFor();
  
  // Nombre base del archivo de pruebas
  const nombreArchivo = 'FEP - Avance 2 de Proyecto.pdf';
  const rutaArchivo = path.resolve(__dirname, `Doc_Prueba/${nombreArchivo}`);

  // 2. Ir a Mis Documentos y verificar que esté limpio
  await expect(frame.locator('#usernameHome')).toBeVisible();
  await frame.getByRole('button', { name: 'Mis Documentos' }).click();
  await waitContenido();
  await expect(frame.locator('h4')).toContainText('Mis Documentos');
  await expect(frame.getByRole('cell')).toContainText('No hay documentos registrados.');

  // 3. Abrir modal "Nuevo Documento"
  await frame.getByRole('button', { name: 'Nuevo Documento' }).click();
  await expect(frame.locator('h5')).toContainText('Subir Trabajo');

  // 4. SELECCIÓN REAL DE ARCHIVO
  await frame.locator('input[type="file"]').setInputFiles(rutaArchivo);

  // 5. Subir y esperar procesamiento
  await frame.getByRole('button', { name: 'Subir Documento' }).click();
  await expect(frame.getByText('Enviando...')).toBeVisible();
  await expect(frame.getByText('Enviando...')).not.toBeVisible({ timeout: 15000 });

  // 6. Verificar que el archivo aparezca en la tabla
  await expect(frame.getByRole('cell', { name: /FEP - Avance 2 de Proyecto\.pdf/i })).toBeVisible();

  // 7. Ver Detalles y validación en Drive
  await frame.getByRole('button', { name: 'Ver Detalles' }).click();
  await expect(frame.getByRole('heading', { name: /FEP - Avance 2 de Proyecto\.pdf/i })).toBeVisible();
  await expect(frame.locator('#previewPDF').getByRole('img')).toBeVisible();

  // Manejo de la nueva pestaña de Google Drive
  const page1Promise = page.waitForEvent('popup');
  await frame.getByRole('button', { name: 'Abrir en Drive' }).click();
  const page1 = await page1Promise;
  
  // VALIDACIÓN EN DRIVE: Se usa coincidencia exacta para evitar duplicados con metadatos ocultos
  await expect(page1.getByText('V1_FEP - Avance 2 de Proyecto.pdf', { exact: true })).toBeVisible();
  await page1.close();

  // 8. Flujo de Eliminación
  await frame.getByRole('button', { name: 'Eliminar Versión' }).click();
  await expect(frame.getByRole('heading', { name: 'Confirmar Eliminación' })).toBeVisible();
  
  await frame.getByRole('button', { name: 'Eliminar Definitivamente' }).click();
  await waitContenido();

  // 9. Verificación final: Volver al estado inicial vacío
  await expect(frame.getByRole('cell')).toContainText('No hay documentos registrados.');
});

test('Flujo completo de documento: subir, versionar, validar en Drive y limpieza', async ({ page }) => {
  // 1. Configuración de URLs y ruta de archivo universal
  await page.goto('');

  const frame = page
    .locator('iframe[title="Evaluapares UABC"]').contentFrame()
    .locator('iframe[title="Evaluapares UABC"]').contentFrame();

  const waitContenido = async () => await frame.locator('#contenido').waitFor();
  
  // Nombre base del archivo de pruebas
  const nombreArchivo = 'FEP - Avance 2 de Proyecto.pdf';
  const rutaArchivo = path.resolve(__dirname, `Doc_Prueba/${nombreArchivo}`);

  // 2. Navegación inicial a Mis Documentos
  await expect(frame.locator('#usernameHome')).toBeVisible();
  await frame.getByRole('button', { name: 'Ir' }).nth(2).click();
  await waitContenido();
  await expect(frame.locator('h4')).toContainText('Mis Documentos');
  await expect(frame.getByRole('cell')).toContainText('No hay documentos registrados.');

  // 3. Subir Primera Versión (V1)
  await frame.getByRole('button', { name: 'Nuevo Documento' }).click();
  await expect(frame.locator('h5')).toContainText('Subir Trabajo');
  
  // Selección e inyección real del archivo
  await frame.locator('input[type="file"]').setInputFiles(rutaArchivo);
  await frame.getByRole('button', { name: 'Subir Documento' }).click();
  
  // Validar estados de carga
  await expect(frame.locator('#mensajeSubida')).toContainText('Enviando...');
  await expect(frame.locator('#mensajeSubida')).not.toBeVisible({ timeout: 20000 });
  await expect(frame.getByRole('cell', { name: new RegExp(nombreArchivo, 'i') })).toBeVisible();

  // 4. Ver Detalles y validar estado inicial
  await frame.getByRole('button', { name: 'Ver Detalles' }).click();
  await expect(frame.getByRole('heading', { name: 'Cargando documento...' })).not.toBeVisible();
  await expect(frame.getByRole('heading', { name: new RegExp(nombreArchivo, 'i') })).toBeVisible();
  await expect(frame.getByRole('cell')).toContainText('Aún no se han asignado dictaminadores.');

  // 5. Subir Nueva Versión (V2)
  await frame.getByRole('button', { name: 'Subir Nueva Versión' }).click();
  await expect(frame.locator('#modalNuevaVersion')).toContainText('Subir Nueva Versión');
  
  // Selección e inyección real para la V2
  await frame.locator('#modalNuevaVersion input[type="file"]').setInputFiles(rutaArchivo);
  await frame.getByRole('button', { name: 'Subir Versión' }).click();
  
  await expect(frame.locator('#statusSubidaVersion')).toContainText('Subiendo archivo al servidor institucional...');
  await expect(frame.locator('#tabsVersiones')).toContainText('V2', { timeout: 20000 });

  // 6. Validación de la nueva pestaña en Google Drive
  const page1Promise = page.waitForEvent('popup');
  await frame.getByRole('button', { name: 'Abrir en Drive' }).click();
  const page1 = await page1Promise;
  
  // Evitamos problemas de selectores duplicados usando coincidencia exacta
  await expect(page1.getByText(`V2_${nombreArchivo}`, { exact: true })).toBeVisible();
  await page1.close();

  // 7. Eliminar Primera Versión (V1)
  await frame.getByRole('link', { name: 'V1' }).click();
  await frame.getByRole('button', { name: 'Eliminar Versión' }).click();
  await expect(frame.locator('#modalConfirmarEliminar')).toContainText('Confirmar Eliminación');
  await frame.getByRole('button', { name: 'Eliminar Definitivamente' }).click();

  // 8. Regresar a Mis Documentos y verificar que el registro sigue vivo (por la V2)
  await frame.getByRole('button', { name: 'Mis Documentos' }).click();
  await waitContenido();
  await expect(frame.locator('h4')).toContainText('Mis Documentos');
  await expect(frame.getByRole('cell', { name: new RegExp(nombreArchivo, 'i') })).toBeVisible();

  // 9. Eliminar Versión Restante (V2) y Limpieza Total
  await frame.getByRole('button', { name: 'Ver Detalles' }).click();
  await expect(frame.locator('#tabsVersiones')).toContainText('V2');
  await frame.getByRole('button', { name: 'Eliminar Versión' }).click();
  await expect(frame.locator('#modalConfirmarEliminar')).toContainText('Confirmar Eliminación');
  await frame.getByRole('button', { name: 'Eliminar Definitivamente' }).click();
  
  // Esperar a que los loaders terminen y la tabla quede limpia
  await expect(frame.locator('#statusEliminar')).toContainText('Eliminando registros de versión...');
  await waitContenido();
  await expect(frame.getByRole('cell')).toContainText('No hay documentos registrados.');
});

test('Flujo de múltiples documentos: subir, validar contadores en Mi Cuenta y limpieza', async ({ page }) => {
  // 1. Navegación e inicialización del Frame anidado
  await page.goto('');

  const frame = page
    .locator('iframe[title="Evaluapares UABC"]').contentFrame()
    .locator('iframe[title="Evaluapares UABC"]').contentFrame();

  const waitContenido = async () => await frame.locator('#contenido').waitFor();

  // Nombres de los archivos de prueba
  const archivo1 = 'FEP - Avance 2 de Proyecto.pdf';
  const archivo2 = 'Meta 4.1.2 - FEP - Avance de Proyecto .pdf';

  // 2. Verificación de Inicio y navegación a Mis Documentos
  await expect(frame.locator('#usernameHome')).toBeVisible();
  await expect(frame.locator('#usernameHome')).not.toBeEmpty(); // Universal
  await expect(frame.locator('#btnDocumentos')).toContainText('Mis Documentos');
  await expect(frame.locator('#cardTitleDinamico')).toContainText('Mis Documentos');
  
  await frame.locator('#cardBtnDinamico').click();
  await waitContenido();
  await expect(frame.getByRole('heading', { name: 'Mis Documentos' })).toBeVisible(); // Corrección Strict Mode
  await expect(frame.getByRole('cell')).toContainText('No hay documentos registrados.');

  // 3. Subir el Primer Documento
  await frame.getByRole('button', { name: 'Nuevo Documento' }).click();
  await expect(frame.locator('h5')).toContainText('Subir Trabajo');
  
  // Inyección del archivo 1 (Removido clic en 'Choose File')
  await frame.locator('input[type="file"]').setInputFiles(path.resolve(__dirname, `Doc_Prueba/${archivo1}`));
  await frame.getByRole('button', { name: 'Subir Documento' }).click();
  
  await expect(frame.locator('#mensajeSubida')).toContainText('Enviando...');
  await expect(frame.locator('#mensajeSubida')).not.toBeVisible({ timeout: 15000 });
  await expect(frame.getByRole('cell', { name: new RegExp(archivo1, 'i') })).toBeVisible();

  // 4. Validar Mi Cuenta - Borradores: 1
  await frame.getByRole('button', { name: 'Mi cuenta' }).click();
  await waitContenido();
  await expect(frame.locator('#card-stats-autor')).toContainText('Mis Trabajos');
  await expect(frame.locator('small')).toContainText('Autor');
  await expect(frame.locator('#stat-aut-borradores')).toContainText('1');

  // 5. Volver a Mis Documentos y subir el Segundo Documento
  await frame.getByRole('button', { name: 'Mis Documentos' }).click();
  await waitContenido();
  await expect(frame.getByRole('heading', { name: 'Mis Documentos' })).toBeVisible();

  await frame.getByRole('button', { name: 'Nuevo Documento' }).click();
  await expect(frame.locator('h5')).toContainText('Subir Trabajo');
  
  // Inyección del archivo 2
  await frame.locator('input[type="file"]').setInputFiles(path.resolve(__dirname, `Doc_Prueba/${archivo2}`));
  await frame.getByRole('button', { name: 'Subir Documento' }).click();
  
  await expect(frame.locator('#mensajeSubida')).toContainText('Enviando...');
  await expect(frame.locator('#mensajeSubida')).not.toBeVisible({ timeout: 15000 });
  // Usamos una concordancia parcial ya que el nombre del segundo archivo puede salir recortado en la tabla
  await expect(frame.getByRole('cell', { name: /Meta 4\.1\.2 - FEP - Avance de/i })).toBeVisible();

  // 6. Validar Mi Cuenta - Borradores: 2
  await frame.getByRole('button', { name: 'Mi cuenta' }).click();
  await waitContenido();
  await expect(frame.locator('#stat-aut-borradores')).toContainText('2');

  // 7. Regresar para iniciar la eliminación de documentos
  await frame.getByRole('button', { name: 'Mis Documentos' }).click();
  await waitContenido();
  await expect(frame.getByRole('heading', { name: 'Mis Documentos' })).toBeVisible();

  // 8. Eliminar el Primer Documento
  await frame.getByRole('button', { name: 'Ver Detalles' }).first().click();
  await expect(frame.getByRole('heading', { name: new RegExp(archivo1, 'i') })).toBeVisible();
  await frame.getByRole('button', { name: 'Eliminar Versión' }).click();
  await expect(frame.locator('#modalConfirmarEliminar')).toContainText('Confirmar Eliminación');
  await frame.getByRole('button', { name: 'Eliminar Definitivamente' }).click();
  
  // Esperas de procesamiento
  await expect(frame.locator('#statusEliminar')).toContainText('Eliminando registros de versión...');
  await waitContenido();
  await expect(frame.getByRole('heading', { name: 'Mis Documentos' })).toBeVisible();

  // 9. Eliminar el Segundo Documento
  await frame.getByRole('button', { name: 'Ver Detalles' }).click(); // Queda uno solo, no requiere .first()
  await expect(frame.getByRole('heading', { name: /Meta 4\.1\.2 - FEP - Avance de/i })).toBeVisible();
  await frame.getByRole('button', { name: 'Eliminar Versión' }).click();
  await expect(frame.locator('#modalConfirmarEliminar')).toContainText('Confirmar Eliminación');
  await frame.getByRole('button', { name: 'Eliminar Definitivamente' }).click();
  
  // Esperas finales de procesamiento
  await expect(frame.locator('#statusEliminar')).toContainText('Eliminando registros de versión...');
  await waitContenido();
  
  // 10. Verificación Final: Todo vacío
  await expect(frame.getByRole('cell')).toContainText('No hay documentos registrados.');
});