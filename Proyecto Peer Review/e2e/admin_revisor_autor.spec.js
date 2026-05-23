import { test, expect } from './fixtures';
import path from 'path';

test('Flujo de navegación completo: Usuario con Triple Rol Simultáneo (Admin, Revisor y Autor) universal', async ({ page }) => {
  // 1. Navegación e inicialización del Frame anidado
  await page.goto('');

  const frame = page
    .locator('iframe[title="Evaluapares UABC"]').contentFrame()
    .locator('iframe[title="Evaluapares UABC"]').contentFrame();

  const waitContenido = async () => await frame.locator('#contenido').waitFor();

  // 2. Verificaciones iniciales en el Panel de Administración (Vista Admin Base)
  // CORRECCIÓN STRICT MODE: Reemplazo de h4 por heading específico
  await expect(frame.getByRole('heading', { name: 'Panel de Administración' })).toBeVisible();
  
  // Aislamos la tabla general de administración para evitar conflictos con otras cargas del DOM
  const tablaDocsAdmin = frame.locator('#tablaDocumentosGeneral, #contenido table').first();
  await expect(tablaDocsAdmin.getByRole('cell')).toContainText('No hay documentos registrados.');

  // 3. Interacción con el Modal de Gestión de Usuarios
  await frame.getByRole('button', { name: 'Gestionar Usuarios' }).click();
  await expect(frame.locator('#modalUsuariosLabel')).toContainText('Control de Privilegios de Acceso');
  await frame.getByRole('button', { name: 'Cerrar' }).click();

  // 4. Verificación de la barra de navegación: Coexistencia del Triple Rol
  await expect(frame.getByRole('button', { name: 'Mis Documentos' })).toBeVisible();
  await expect(frame.getByRole('button', { name: 'Revisiones Asignadas' })).toBeVisible();
  await expect(frame.getByRole('button', { name: 'Panel Admin' })).toBeVisible();

  // 5. Pantalla de Inicio y verificación de la Tarjeta Dinámica Principal
  await frame.getByRole('button', { name: 'Inicio' }).click();
  await waitContenido();
  await expect(frame.locator('#usernameHome')).toBeVisible();
  await expect(frame.locator('#cardTitleDinamico')).toContainText('Mis Revisiones');

  // 6. Navegación a Mi Cuenta: Validación Exhaustiva del Triple Perfil
  await frame.getByRole('button', { name: 'Mi cuenta' }).click();
  await waitContenido();
  
  await expect(frame.locator('#contenido')).toContainText('Datos de Usuario');
  await expect(frame.locator('#u-nombre')).toBeVisible();
  await expect(frame.locator('#u-nombre')).not.toBeEmpty();
  await expect(frame.getByText(/@uabc\.edu\.mx/i)).toBeVisible(); // Validación por Regex de correo universal

  // Validar presencia de los 3 badges de rol simultáneos
  await expect(frame.locator('#u-roles-container')).toContainText('Admin');
  await expect(frame.locator('#u-roles-container')).toContainText('Revisor');
  await expect(frame.locator('#u-roles-container')).toContainText('Autor');

  // Validar presencia de los 3 bloques de estadísticas independientes
  await expect(frame.locator('#card-stats-autor')).toContainText('Mis Trabajos');
  await expect(frame.locator('#card-stats-revisor')).toContainText('Revisiones');
  await expect(frame.locator('#card-stats-admin')).toContainText('Trabajos en Sistema');

  // 7. Auditoría de Sección: Mis Documentos (Entorno de Autor)
  await frame.getByRole('button', { name: 'Mis Documentos' }).click();
  await waitContenido();
  // CORRECCIÓN STRICT MODE: Evitamos h4 genérico usando heading específico
  await expect(frame.getByRole('heading', { name: 'Mis Documentos' })).toBeVisible();
  
  const tablaDocsAutor = frame.locator('#tablaDocumentos, #contenido table').first();
  await expect(tablaDocsAutor.getByRole('cell', { name: 'No hay documentos registrados.' })).toBeVisible();
  await expect(tablaDocsAutor.getByRole('cell')).toContainText('No hay documentos registrados.');

  // 8. Auditoría de Sección: Revisiones Asignadas (Entorno de Revisor)
  await frame.getByRole('button', { name: 'Revisiones Asignadas' }).click();
  await waitContenido();
  // CORRECCIÓN STRICT MODE: Reemplazo de h4 genérico por heading específico
  await expect(frame.getByRole('heading', { name: 'Revisiones Asignadas' })).toBeVisible();
  
  const tablaRevisiones = frame.locator('#tablaRevisiones, #contenido table').first();
  await expect(tablaRevisiones.getByRole('cell')).toContainText('No hay evaluaciones asignadas.');

  // Sincronizar asignaciones con el backend de Google
  await frame.getByRole('button', { name: 'Actualizar' }).click();
  await expect(tablaRevisiones.getByRole('cell')).toContainText('Consultando asignaciones...');
  await expect(tablaRevisiones.getByRole('cell')).not.toContainText('Consultando asignaciones...', { timeout: 15000 });

  // 9. Cierre del ciclo: Regreso seguro al Panel de Administración
  await frame.getByRole('button', { name: 'Panel Admin' }).click();
  await waitContenido();
  await expect(frame.getByRole('heading', { name: 'Panel de Administración' })).toBeVisible();
});

test('Flujo de integración avanzado: Ciclo completo cooperativo Multi-rol universal (Rechazo de Revisión)', async ({ page }) => {
  // 1. Navegación e inicialización del Frame anidado
  await page.goto('');

  const frame = page
    .locator('iframe[title="Evaluapares UABC"]').contentFrame()
    .locator('iframe[title="Evaluapares UABC"]').contentFrame();

  const waitContenido = async () => await frame.locator('#contenido').waitFor();
  const nombreArchivo = 'FEP - Avance 2 de Proyecto.pdf';

  // 2. Verificaciones iniciales en el Panel de Administración (Vista Admin)
  await expect(frame.getByRole('heading', { name: 'Panel de Administración' })).toBeVisible();
  await expect(frame.getByRole('heading', { name: 'Alejandro Castro Renteria' })).toBeVisible();
  
  const tablaDocsAdmin = frame.locator('#tablaDocumentosGeneral, #contenido table').first();
  await expect(tablaDocsAdmin.getByRole('cell')).toContainText('No hay documentos registrados.');

  // Confirmar coexistencia de accesos cruzados debido al multi-rol asignado
  await expect(frame.getByRole('button', { name: 'Mis Documentos' })).toBeVisible();
  await expect(frame.getByRole('button', { name: 'Revisiones Asignadas' })).toBeVisible();
  await expect(frame.getByRole('button', { name: 'Panel Admin' })).toBeVisible();

  // 3. Navegación a Mis Documentos (Vista Autor) y subida de archivo
  await frame.getByRole('button', { name: 'Mis Documentos' }).click();
  await waitContenido();
  await expect(frame.getByRole('heading', { name: 'Mis Documentos' })).toBeVisible();
  
  const tablaDocsAutor = frame.locator('#tablaDocumentos, #contenido table').first();
  await expect(tablaDocsAutor.getByRole('cell')).toContainText('No hay documentos registrados.');

  await frame.getByRole('button', { name: 'Nuevo Documento' }).click();
  await expect(frame.locator('h5')).toContainText('Subir Trabajo');
  
  // Carga directa del documento sin clics invasivos al input nativo
  await frame.locator('input[type="file"]').setInputFiles(path.resolve(__dirname, `Doc_Prueba/${nombreArchivo}`));
  await frame.getByRole('button', { name: 'Subir Documento' }).click();
  
  // Sincronización del estado de envío asíncrono
  await expect(frame.locator('#mensajeSubida')).toContainText('Enviando...');
  await expect(frame.locator('#mensajeSubida')).not.toBeVisible({ timeout: 15000 });
  await expect(tablaDocsAutor.getByRole('cell', { name: nombreArchivo })).toBeVisible();

  // 4. Regreso a Administración para Gestión de Flujo (Vista Admin)
  await frame.getByRole('button', { name: 'Panel Admin' }).click();
  await waitContenido();
  await expect(tablaDocsAdmin.getByRole('cell', { name: nombreArchivo })).toBeVisible({ timeout: 10000 });

  // 5. Gestión de Evaluadores dentro del Modal de Asignación
  await frame.getByRole('button', { name: 'Asignar Revisor' }).click();
  await expect(frame.locator('#modalAsignarLabel')).toContainText('Asignar Evaluador Técnico');
  await expect(frame.getByLabel('Asignar Evaluador Técnico').getByText('Alejandro Castro Renteria')).toBeVisible();
  
  // Primera asignación simulada
  await frame.locator('#listaRevisoresSistema').getByRole('button', { name: 'Asignar' }).first().click();
  await expect(frame.getByTitle('a1183297@uabc.edu.mx')).toBeVisible();
  
  // Cancelación / Desasignación mediante botón 'X'
  await frame.getByRole('button', { name: 'X' }).click();
  await expect(frame.locator('#listaRevisoresAsignados')).toContainText('Sin revisores en esta versión.');
  
  // Asignación definitiva para el flujo de pruebas
  await frame.locator('#listaRevisoresSistema').getByRole('button', { name: 'Asignar' }).first().click();
  await expect(frame.locator('#listaRevisoresAsignados')).toContainText('Pendiente');
  await frame.getByRole('button', { name: 'Cerrar Ventana' }).click();

  // 6. Auditoría y Rechazo de la revisión asignada (Vista Revisor)
  await frame.getByRole('button', { name: 'Revisiones Asignadas' }).click();
  await waitContenido();
  await expect(frame.getByRole('heading', { name: 'Revisiones Asignadas' })).toBeVisible();
  
  const tablaRevisiones = frame.locator('#tablaRevisiones, #contenido table').first();
  await expect(tablaRevisiones.getByRole('cell', { name: 'V1_FEP - Avance 2 de Proyecto' })).toBeVisible();
  await expect(tablaRevisiones).toContainText('Anónimo (Autor)');
  
  // Acción de Rechazar asignación
  await frame.getByRole('button', { name: 'Rechazar' }).click();
  
  // 🔄 CORRECCIÓN DEL TIMING: Esperamos explícitamente a que el archivo desaparezca de la tabla.
  // Esto le da tiempo al backend de Google de borrar la fila antes de que busquemos el texto de "No hay..."
  await expect(tablaRevisiones.getByRole('cell', { name: 'V1_FEP - Avance 2 de Proyecto' })).not.toBeVisible({ timeout: 20000 });

  // Ahora que la fila desapareció, el texto esperado pasará limpio sin conflictos de Strict Mode
  await expect(tablaRevisiones.getByRole('cell')).toContainText('No hay evaluaciones asignadas.');

  // 7. Navegación a Mis Documentos para auditoría de detalles (Vista Autor)
  await frame.getByRole('button', { name: 'Panel Admin' }).click();
  await waitContenido();
  await frame.getByRole('button', { name: 'Mis Documentos' }).click();
  await waitContenido();
  await expect(frame.getByRole('heading', { name: 'Mis Documentos' })).toBeVisible();
  
  // Inspección de visualización previa
  await frame.getByRole('button', { name: 'Ver Detalles' }).click();
  await waitContenido();
  await expect(frame.locator('#previewPDF').getByRole('img')).toBeVisible();

  // 8. Eliminación permanente del archivo para limpieza del sistema
  await frame.getByRole('button', { name: 'Eliminar Versión' }).click();
  await expect(frame.locator('#modalConfirmarEliminar')).toContainText('Confirmar Eliminación');
  await frame.getByRole('button', { name: 'Eliminar Definitivamente' }).click();
  
  // Esperar a que el backend de Google Sheets limpie los registros
  await expect(frame.locator('#statusEliminar')).toContainText('Eliminando registros de versión...');
  await expect(frame.locator('#statusEliminar')).not.toBeVisible({ timeout: 15000 });
  await expect(tablaDocsAutor.getByRole('cell')).toContainText('No hay documentos registrados.');

  // 9. Comprobación de limpieza final en la base del Panel Admin
  await frame.getByRole('button', { name: 'Panel Admin' }).click();
  await waitContenido();
  await expect(frame.getByRole('heading', { name: 'Panel de Administración' })).toBeVisible();
  await expect(tablaDocsAdmin.getByRole('cell')).toContainText('No hay documentos registrados.');
});