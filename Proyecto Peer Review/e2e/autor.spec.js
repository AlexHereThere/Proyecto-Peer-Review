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
  const rutaArchivo = path.resolve(__dirname, 'Doc_Prueba/FEP - Avance 2 de Proyecto.pdf');  
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