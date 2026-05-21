import { test, expect } from '@playwright/test';

test('Exploración completa de Evaluapares UABC', async ({ page }) => {
  await page.goto('');

  const app = page
    .frameLocator('iframe[title="Evaluapares UABC"]')
    .frameLocator('iframe[title="Evaluapares UABC"]');

  // --- INICIO (Carga inicial pesada) ---
  await expect(app.locator('h2')).toContainText('¡Bienvenido a Evaluapares!', { timeout: 60000 });
  await expect(app.locator('#usernameHome')).toBeVisible({ timeout: 20000 });

  // --- SOBRE NOSOTROS ---
  await app.getByRole('button', { name: 'Ir' }).first().click();
  // Validamos que el contenedor cambie, dando tiempo al servidor
  await expect(app.locator('#contenido')).toContainText('¿Qué es Evaluapares?', { timeout: 20000 });

  // Regresar a Inicio
  await app.getByRole('button', { name: 'Inicio' }).click();
  await expect(app.locator('#usernameHome')).toBeVisible({ timeout: 15000 });

  // --- MIS DOCUMENTOS (Desde botón central) ---
  await app.getByRole('button', { name: 'Ir' }).nth(2).click();
  // Primero validamos el contenedor para evitar el error de h4 duplicados
  await expect(app.locator('#contenido')).toContainText('Mis Documentos', { timeout: 20000 });
  await expect(app.locator('h4').filter({ hasText: 'Mis Documentos' })).toBeVisible();

  // Regresar a Inicio
  await app.getByRole('button', { name: 'Inicio' }).click();
  await expect(app.locator('h2')).toContainText('¡Bienvenido a Evaluapares!', { timeout: 15000 });

  // --- NAVEGACIÓN LATERAL (Sidebar) ---
  
  // Mi cuenta
  await app.getByRole('button', { name: 'Mi cuenta' }).click();
  await expect(app.locator('#contenido')).toContainText('Datos de Usuario', { timeout: 20000 });

  // Mis Documentos
  await app.getByRole('button', { name: 'Mis Documentos' }).click();
  await expect(app.locator('#contenido')).toContainText('Mis Documentos', { timeout: 20000 });
  // Usamos filter para evitar el error de "strict mode violation" con los h4
  await expect(app.locator('h4').filter({ hasText: 'Mis Documentos' })).toBeVisible();

  // Revisiones Asignadas
  await app.getByRole('button', { name: 'Revisiones Asignadas' }).click();
  await expect(app.locator('#contenido')).toContainText('Revisiones Asignadas', { timeout: 20000 });
  await expect(app.locator('h4').filter({ hasText: 'Revisiones Asignadas' })).toBeVisible();

  // Sobre Nosotros
  await app.getByRole('button', { name: 'Sobre Nosotros' }).click();
  await expect(app.locator('#contenido')).toContainText('¿Qué es Evaluapares?', { timeout: 20000 });

  // --- FIN ---
  await app.getByRole('button', { name: 'Inicio' }).click();
  await expect(app.locator('#usernameHome')).toBeVisible({ timeout: 20000 });
});