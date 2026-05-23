import { test, expect } from './fixtures';

test('Flujo de navegación: usuario con múltiples roles (Autor y Revisor) universal', async ({ page }) => {
  // 1. Navegación e inicialización del Frame anidado
  await page.goto('');

  const frame = page
    .locator('iframe[title="Evaluapares UABC"]').contentFrame()
    .locator('iframe[title="Evaluapares UABC"]').contentFrame();

  const waitContenido = async () => await frame.locator('#contenido').waitFor();

  // 2. Verificaciones iniciales en la pantalla de Inicio / Home
  await expect(frame.locator('#usernameHome')).toBeVisible();
  await expect(frame.locator('#usernameHome')).not.toBeEmpty(); // Universal: no depende de un nombre fijo
  await expect(frame.locator('#cardTitleDinamico')).toContainText('Mis Revisiones');
  
  // Validar botones de acceso rápido visibles en el menú/interfaz
  await expect(frame.getByRole('button', { name: 'Revisiones Asignadas' })).toBeVisible();
  await expect(frame.getByRole('button', { name: 'Mis Documentos' })).toBeVisible();

  // 3. Navegación a Mi Cuenta y validación del Multi-rol
  await frame.getByRole('button', { name: 'Mi cuenta' }).click();
  await waitContenido();
  
  await expect(frame.locator('#contenido')).toContainText('Datos de Usuario');
  await expect(frame.locator('#u-nombre')).toBeVisible();
  await expect(frame.locator('#u-nombre')).not.toBeEmpty();
  await expect(frame.getByText(/@uabc\.edu\.mx/i)).toBeVisible(); // Correo universal

  // Verificación de la coexistencia de ambos roles y sus tarjetas estadísticas
  await expect(frame.locator('#u-roles-container')).toContainText('Revisor');
  await expect(frame.locator('#u-roles-container')).toContainText('Autor');
  await expect(frame.locator('#card-stats-autor')).toContainText('Mis Trabajos');
  await expect(frame.locator('#card-stats-revisor')).toContainText('Revisiones');

  // 4. Navegación a Mis Documentos (Rol Autor)
  await frame.getByRole('button', { name: 'Mis Documentos' }).click();
  await waitContenido();
  // CORRECCIÓN STRICT MODE: Buscamos por heading específico en vez de un 'h4' genérico
  await expect(frame.getByRole('heading', { name: 'Mis Documentos' })).toBeVisible();
  await expect(frame.getByRole('cell')).toContainText('No hay documentos registrados.');

  // 5. Navegación a Revisiones Asignadas (Rol Revisor)
  await frame.getByRole('button', { name: 'Revisiones Asignadas' }).click();
  await waitContenido();
  // CORRECCIÓN STRICT MODE: Mismo cambio para el panel de revisiones
  await expect(frame.getByRole('heading', { name: 'Revisiones Asignadas' })).toBeVisible();
  await expect(frame.getByRole('cell')).toContainText('No hay evaluaciones asignadas.');

  // 6. Acción de actualizar asignaciones
  await frame.getByRole('button', { name: 'Actualizar' }).click();
  await expect(frame.getByRole('cell')).toContainText('Consultando asignaciones...');
  await expect(frame.getByRole('cell')).not.toContainText('Consultando asignaciones...', { timeout: 15000 });

  // 7. Regreso a Inicio / Home y validación de cierre
  await frame.getByRole('button', { name: 'Inicio' }).click();
  await waitContenido();
  await expect(frame.locator('#usernameHome')).toBeVisible();
  await expect(frame.locator('#usernameHome')).not.toBeEmpty();
});