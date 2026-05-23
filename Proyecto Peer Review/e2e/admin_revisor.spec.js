import { test, expect } from './fixtures';

test('Flujo de navegación: usuario con roles Admin y Revisor simultáneos universal', async ({ page }) => {
  // 1. Navegación e inicialización del Frame anidado
  await page.goto('');

  const frame = page
    .locator('iframe[title="Evaluapares UABC"]').contentFrame()
    .locator('iframe[title="Evaluapares UABC"]').contentFrame();

  const waitContenido = async () => await frame.locator('#contenido').waitFor();

  // 2. Verificaciones iniciales en el Panel de Administración
  await expect(frame.getByRole('heading', { name: 'Panel de Administración' })).toBeVisible();
  
  // Acotamos la búsqueda de celdas a la tabla principal para evitar conflictos si hay modales en el fondo
  const tablaDocsAdmin = frame.locator('#tablaDocumentosGeneral, #contenido table').first();
  await expect(tablaDocsAdmin.getByRole('cell')).toContainText('No hay documentos registrados.');

  // 3. Acción de actualizar en el Panel Admin
  await frame.getByRole('button', { name: 'Actualizar' }).click();
  await expect(tablaDocsAdmin.getByRole('cell')).toContainText('Cargando documentos...');
  await expect(tablaDocsAdmin.getByRole('cell')).not.toContainText('Cargando documentos...', { timeout: 15000 });

  // 4. Interacción con el Modal de Gestión de Usuarios
  await frame.getByRole('button', { name: 'Gestionar Usuarios' }).click();
  await expect(frame.locator('#modalUsuariosLabel')).toContainText('Control de Privilegios de Acceso');
  await frame.getByRole('button', { name: 'Cerrar' }).click();

  // Verificar la reactividad inicial de accesos directos permitidos para Admin + Revisor
  await expect(frame.getByRole('button', { name: 'Revisiones Asignadas' })).toBeVisible();
  await expect(frame.getByRole('button', { name: 'Panel Admin' })).toBeVisible();

  // 5. Navegación a Mi Cuenta y validación de Datos / Multi-rol
  await frame.getByRole('button', { name: 'Mi cuenta' }).click();
  await waitContenido();
  
  await expect(frame.locator('#contenido')).toContainText('Datos de Usuario');
  await expect(frame.locator('#u-nombre')).toBeVisible();
  await expect(frame.locator('#u-nombre')).not.toBeEmpty();
  await expect(frame.getByText(/@uabc\.edu\.mx/i)).toBeVisible(); // Validación de correo universal

  // Validar coexistencia de los badges de roles asignados
  await expect(frame.locator('#u-roles-container')).toContainText('Admin');
  await expect(frame.locator('#u-roles-container')).toContainText('Revisor');

  // Validar coexistencia de las tarjetas estadísticas correspondientes
  await expect(frame.locator('#card-stats-revisor')).toContainText('Revisiones');
  await expect(frame.locator('#card-stats-admin')).toContainText('Trabajos en Sistema');

  // 6. Navegación a Inicio y validación de la tarjeta dinámica
  await frame.getByRole('button', { name: 'Inicio' }).click();
  await waitContenido();
  await expect(frame.locator('#usernameHome')).toBeVisible();
  await expect(frame.locator('#cardTitleDinamico')).toContainText('Mis Revisiones');

  // Clic en el botón dinámico de la tarjeta (Acceso directo a revisiones)
  await frame.locator('#cardBtnDinamico').click();
  await waitContenido();

  // 7. Validación del Panel de Revisiones Asignadas
  await expect(frame.getByRole('heading', { name: 'Revisiones Asignadas' })).toBeVisible();
  
  const tablaRevisiones = frame.locator('#tablaRevisiones, #contenido table').first();
  await expect(tablaRevisiones.getByRole('cell')).toContainText('No hay evaluaciones asignadas.');

  // Consultar / Sincronizar asignaciones en el backend
  await frame.getByRole('button', { name: 'Actualizar' }).click();
  await expect(tablaRevisiones.getByRole('cell')).toContainText('Consultando asignaciones...');
  await expect(tablaRevisiones.getByRole('cell')).not.toContainText('Consultando asignaciones...', { timeout: 15000 });

  // 8. Regreso al punto de origen (Panel Admin)
  await frame.getByRole('button', { name: 'Panel Admin' }).click();
  await waitContenido();
  await expect(frame.getByRole('heading', { name: 'Panel de Administración' })).toBeVisible();
});