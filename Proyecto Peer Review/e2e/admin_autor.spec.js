import { test, expect } from './fixtures';
import path from 'path';

test('Flujo de navegación: usuario con roles Admin y Autor simultáneos universal', async ({ page }) => {
  // 1. Navegación e inicialización del Frame anidado
  await page.goto('');

  const frame = page
    .locator('iframe[title="Evaluapares UABC"]').contentFrame()
    .locator('iframe[title="Evaluapares UABC"]').contentFrame();

  const waitContenido = async () => await frame.locator('#contenido').waitFor();

  // 2. Captura del nombre del administrador logueado de forma dinámica
  await expect(frame.getByRole('heading', { name: 'Panel de Administración' })).toBeVisible();
  const nombreAdmin = await frame.getByRole('heading').first().innerText();

  // 3. Interacción con el modal de Usuarios
  await frame.getByRole('button', { name: 'Gestionar Usuarios' }).click();
  await expect(frame.locator('#modalUsuariosLabel')).toContainText('Control de Privilegios de Acceso');
  await frame.getByRole('button', { name: 'Close' }).click();

  // 🔄 CORRECCIÓN CRÍTICA: Esperar a que los loaders iniciales desaparezcan de pantalla
  // Esto evita la violación de Strict Mode al limpiar las celdas de carga asíncronas
  await expect(frame.getByRole('cell', { name: 'Cargando documentos...' })).not.toBeVisible({ timeout: 15000 });
  await expect(frame.getByRole('cell', { name: 'Cargando usuarios...' })).not.toBeVisible({ timeout: 15000 });

  // Especificamos que busque el texto vacío dentro de la tabla de documentos principal
  await expect(frame.locator('#tablaDocumentos, #contenido table').first().getByRole('cell')).toContainText('No hay documentos registrados.');

  // 4. Acción de actualizar documentos de forma controlada
  await frame.getByRole('button', { name: 'Actualizar' }).click();
  await expect(frame.locator('#tablaDocumentos, #contenido table').first().getByRole('cell')).toContainText('Cargando documentos...');
  await expect(frame.locator('#tablaDocumentos, #contenido table').first().getByRole('cell')).not.toContainText('Cargando documentos...', { timeout: 15000 });

  // 5. Verificar visibilidad inicial de accesos cruzados (Admin + Autor)
  await expect(frame.getByRole('button', { name: 'Panel Admin' })).toBeVisible();
  await expect(frame.getByRole('button', { name: 'Mis Documentos' })).toBeVisible();

  // 6. Ir a Inicio y verificar la tarjeta dinámica adaptada al rol prioritario
  await frame.getByRole('button', { name: 'Inicio' }).click();
  await waitContenido();
  await expect(frame.locator('#usernameHome')).toBeVisible();
  await expect(frame.locator('#cardTitleDinamico')).toContainText('Mis Documentos');

  // 7. Navegación a Mi Cuenta y validación del Perfil y Multi-rol
  await frame.getByRole('button', { name: 'Mi cuenta' }).click();
  await waitContenido();
  
  await expect(frame.locator('#contenido')).toContainText('Datos de Usuario');
  await expect(frame.locator('#u-nombre')).toBeVisible();
  await expect(frame.locator('#u-nombre')).not.toBeEmpty();
  await expect(frame.getByText(/@uabc\.edu\.mx/i)).toBeVisible();

  // Confirmar la coexistencia de ambos roles en los badges
  await expect(frame.locator('#u-roles-container')).toContainText('Admin');
  await expect(frame.locator('#u-roles-container')).toContainText('Autor');

  // Confirmar la coexistencia de estadísticas
  await expect(frame.locator('#card-stats-autor')).toContainText('Mis Trabajos');
  await expect(frame.locator('#card-stats-admin')).toContainText('Trabajos en Sistema');

  // 8. Validación de la sección Mis Documentos (Vista Autor)
  await frame.getByRole('button', { name: 'Mis Documentos' }).click();
  await waitContenido();
  await expect(frame.getByRole('heading', { name: 'Mis Documentos' })).toBeVisible();
  await expect(frame.getByRole('cell')).toContainText('No hay documentos registrados.');

  // 9. Regreso al Panel de Administración (Vista Admin) y cierre del flujo
  await frame.getByRole('button', { name: 'Panel Admin' }).click();
  await waitContenido();
  await expect(frame.getByRole('heading', { name: 'Panel de Administración' })).toBeVisible();
});

test('Flujo de integración completo: Ciclo de vida del documento (Subida, Auditoría y Eliminación) universal', async ({ page }) => {
  // 1. Navegación e inicialización del Frame anidado
  await page.goto('');

  const frame = page
    .locator('iframe[title="Evaluapares UABC"]').contentFrame()
    .locator('iframe[title="Evaluapares UABC"]').contentFrame();

  const waitContenido = async () => await frame.locator('#contenido').waitFor();
  const nombreArchivo = 'FEP - Avance 2 de Proyecto.pdf';

  // 2. Verificación inicial en el Panel de Administración
  await expect(frame.getByRole('heading', { name: 'Panel de Administración' })).toBeVisible();

  // 3. Navegación a Mis Documentos (Vista Autor) y comprobación de estado vacío
  await frame.getByRole('button', { name: 'Mis Documentos' }).click();
  await waitContenido();
  await expect(frame.getByRole('heading', { name: 'Mis Documentos' })).toBeVisible();
  
  // Acotamos el selector a la tabla de documentos de autor para evitar Strict Mode
  const tablaDocsAutor = frame.locator('#tablaDocumentos, #contenido table').first();
  await expect(tablaDocsAutor.getByRole('cell', { name: 'No hay documentos registrados.' })).toBeVisible();

  // 4. Proceso de subida del documento
  await frame.getByRole('button', { name: 'Nuevo Documento' }).click();
  await expect(frame.locator('h5')).toContainText('Subir Trabajo');
  
  // Inyección directa del archivo mediante path sin clics simulados invasivos
  await frame.locator('input[type="file"]').setInputFiles(path.resolve(__dirname, `Doc_Prueba/${nombreArchivo}`));
  await frame.getByRole('button', { name: 'Subir Documento' }).click();
  
  // Sincronización de la subida asíncrona de Google Drive/Apps Script
  await expect(frame.locator('#mensajeSubida')).toContainText('Enviando...');
  await expect(frame.locator('#mensajeSubida')).not.toBeVisible({ timeout: 15000 });
  await expect(tablaDocsAutor.getByRole('cell', { name: nombreArchivo })).toBeVisible();

  // 5. Verificación y Auditoría en el Panel de Administración
  await frame.getByRole('button', { name: 'Panel Admin' }).click();
  await waitContenido();
  await expect(frame.getByRole('heading', { name: 'Panel de Administración' })).toBeVisible();
  
  const tablaDocsAdmin = frame.locator('#tablaDocumentosGeneral, #contenido table').first();
  await expect(tablaDocsAdmin.getByRole('cell', { name: nombreArchivo })).toBeVisible({ timeout: 10000 });

  // 6. Flujo del Modal de Asignación de Revisores
  await frame.getByRole('button', { name: 'Asignar Revisor' }).click();
  await expect(frame.locator('#modalAsignarLabel')).toContainText('Asignar Evaluador Técnico');
  await expect(frame.getByText(/Documento:\s*FEP\s*-\s*Avance\s*2\s*de/i)).toBeVisible();
  await expect(frame.locator('#listaRevisoresSistema')).toContainText('No hay revisores registrados.');
  await expect(frame.locator('#listaRevisoresAsignados')).toContainText('Sin revisores en esta versión.');
  await frame.getByRole('button', { name: 'Cerrar Ventana' }).click();

  // 7. Actualizar y regresar a Mis Documentos
  await frame.getByRole('button', { name: 'Actualizar' }).click();
  await expect(frame.getByRole('cell', { name: 'Cargando documentos...' })).not.toBeVisible({ timeout: 15000 });
  
  await frame.getByRole('button', { name: 'Mis Documentos' }).click();
  await waitContenido();
  await expect(tablaDocsAutor.getByRole('cell', { name: nombreArchivo })).toBeVisible();

  // 8. Ver Detalles y Proceso de Eliminación de la Versión
  await frame.getByRole('button', { name: 'Ver Detalles' }).click();
  await waitContenido();
  await expect(frame.getByRole('heading', { name: nombreArchivo })).toBeVisible();
  
  await frame.getByRole('button', { name: 'Eliminar Versión' }).click();
  await expect(frame.locator('#modalConfirmarEliminar')).toContainText('Confirmar Eliminación');
  await frame.getByRole('button', { name: 'Eliminar Definitivamente' }).click();
  
  // Sincronización del borrado en el backend
  await expect(frame.locator('#statusEliminar')).toContainText('Eliminando registros de versión...');
  await expect(frame.locator('#statusEliminar')).not.toBeVisible({ timeout: 15000 });

  // 9. Confirmación final de limpieza de datos en ambas vistas (Autor y Admin)
  await expect(tablaDocsAutor.getByRole('cell')).toContainText('No hay documentos registrados.');
  
  await frame.getByRole('button', { name: 'Panel Admin' }).click();
  await waitContenido();
  await expect(tablaDocsAdmin.getByRole('cell')).toContainText('No hay documentos registrados.');
});