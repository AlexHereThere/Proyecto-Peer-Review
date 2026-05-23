import { test, expect } from './fixtures';

test('navegación de usuario con todo rol universal.', async ({ page }) => {
  await page.goto('');

  // Localización del Frame principal (anidado)
  const frame = page
    .locator('iframe[title="Evaluapares UABC"]').contentFrame()
    .locator('iframe[title="Evaluapares UABC"]').contentFrame();

  // Panel admin - Verificación inicial
  await expect(frame.getByRole('heading', { name: 'Panel de Administración' })).toBeVisible();

  // Inicio
  await frame.getByRole('button', { name: 'Inicio' }).click();
  await expect(frame.locator('#usernameHome')).toBeVisible();
  // Validación universal del nombre: aseguramos que el campo del nombre esté visible y no vacío
  await expect(frame.locator('#usernameHome')).not.toBeEmpty();

  // Ir -> Mis documentos
  await frame.getByRole('button', { name: 'Ir' }).nth(2).click();
  await expect(frame.getByRole('heading', { name: 'Mis Documentos' })).toBeVisible();

  // Mi cuenta
  await frame.getByRole('button', { name: 'Mi cuenta' }).click();
  await expect(frame.locator('#contenido')).toContainText('Datos de Usuario');
  await expect(frame.locator('#u-nombre')).toBeVisible();
  await expect(frame.locator('#u-nombre')).not.toBeEmpty();
  // Validación universal del correo institucional de la UABC
  await expect(frame.getByText(/^[a-zA-Z0-9._%+-]+@uabc\.edu\.mx$/)).toBeVisible();

  // Regresar a Inicio
  await frame.getByRole('button', { name: 'Inicio' }).click();
  await expect(frame.locator('#usernameHome')).toBeVisible();

  // Primer botón Ir
  await frame.getByRole('button', { name: 'Ir' }).first().click();
  await expect(frame.locator('#contenido')).toBeVisible();

  // Mis documentos
  await frame.getByRole('button', { name: 'Mis Documentos' }).click();
  await expect(frame.getByRole('heading', { name: 'Mis Documentos' })).toBeVisible();

  // Revisiones asignadas
  await frame.getByRole('button', { name: 'Revisiones Asignadas' }).click();
  await expect(frame.getByRole('heading', { name: 'Revisiones Asignadas' })).toBeVisible();

  // Sobre nosotros
  await frame.getByRole('button', { name: 'Sobre Nosotros' }).click();
  await expect(frame.locator('#contenido')).toContainText('¿Qué es Evaluapares?');

  // Volver al Panel admin
  await frame.getByRole('button', { name: 'Panel Admin' }).click();
  await expect(frame.getByRole('heading', { name: 'Panel de Administración' })).toBeVisible();
});


