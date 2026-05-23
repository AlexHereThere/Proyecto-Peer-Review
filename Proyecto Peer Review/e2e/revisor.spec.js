import { test, expect } from './fixtures';

test('Flujo de navegación: usuario rol Revisor universal', async ({ page }) => {
  // 1. Navegación e inicialización del Frame anidado
  await page.goto('');

  const frame = page
    .locator('iframe[title="Evaluapares UABC"]').contentFrame()
    .locator('iframe[title="Evaluapares UABC"]').contentFrame();

  const waitContenido = async () => await frame.locator('#contenido').waitFor();

  // 2. Verificaciones en la pantalla de Inicio / Home
  await expect(frame.locator('#usernameHome')).toBeVisible();
  // Validación universal: nos aseguramos de que el contenedor del nombre no esté vacío
  await expect(frame.locator('#usernameHome')).not.toBeEmpty();
  
  await expect(frame.locator('#cardTitleDinamico')).toContainText('Mis Revisiones');

  // 3. Navegación al panel dinámico (Revisiones Asignadas)
  await frame.locator('#cardBtnDinamico').click();
  await waitContenido();
  
  await expect(frame.getByRole('heading', { name: 'Revisiones Asignadas' })).toBeVisible();
  await expect(frame.getByRole('cell')).toContainText('No hay evaluaciones asignadas.');

  // 4. Acción de actualizar y validar estados de carga
  await frame.getByRole('button', { name: 'Actualizar' }).click();
  await expect(frame.getByRole('cell')).toContainText('Consultando asignaciones...');
  // Esperar a que el texto de consulta desaparezca antes de continuar
  await expect(frame.getByRole('cell')).not.toContainText('Consultando asignaciones...', { timeout: 15000 });

  // 5. Navegación a Mi Cuenta y validación del Rol Revisor
  await frame.getByRole('button', { name: 'Mi cuenta' }).click();
  await waitContenido();
  
  await expect(frame.locator('#contenido')).toContainText('Datos de Usuario');
  await expect(frame.locator('small')).toContainText('Revisor');
  await expect(frame.locator('#card-stats-revisor')).toContainText('Revisiones');
  
  // Validaciones universales del perfil (no vacíos y estructura de correo institucional)
  await expect(frame.locator('#u-nombre')).toBeVisible();
  await expect(frame.locator('#u-nombre')).not.toBeEmpty();
  await expect(frame.getByText(/@uabc\.edu\.mx/i)).toBeVisible();

  // 6. Regresar a Revisiones Asignadas mediante el menú lateral/superior
  await frame.getByRole('button', { name: 'Revisiones Asignadas' }).click();
  await waitContenido();
  
  // CORRECCIÓN: Mismo cambio aquí para asegurar que busque el encabezado correcto
  await expect(frame.getByRole('heading', { name: 'Revisiones Asignadas' })).toBeVisible();
});