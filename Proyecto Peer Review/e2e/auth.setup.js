import { test as setup } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Tiempo infinito para que hagas el login manual sin prisas
  setup.setTimeout(0); 

  await page.setExtraHTTPHeaders({
    'Accept-Language': 'es-ES,es;q=0.9'
  });

  // 1. Ir a Google para el Login manual
  await page.goto('https://accounts.google.com/');
  console.log("--> ESPERANDO LOGIN MANUAL EN GOOGLE...");
  await page.pause(); 

  // 2. Ir a la App (usando la baseURL configurada)
  // Al usar '', Playwright entiende que vas a la raíz de la baseURL
  await page.goto('');
  console.log("--> Navegando a la App de Google Script...");

  // 3. Localizar el elemento usando la jerarquía detectada por Codegen
  // Esta cadena reemplaza a todo tu bucle 'while' y 'for'
  const appFrame = page
    .frameLocator('iframe[title="Evaluapares UABC"]')
    .frameLocator('iframe[title="Evaluapares UABC"]');

  const userIdentifier = appFrame.locator('#userName');

  console.log("--> Verificando carga del perfil...");
  
  // Esperamos a que el elemento aparezca. Si aparece, la sesión es válida.
  await userIdentifier.waitFor({ state: 'visible', timeout: 60000 });
  
  const name = await userIdentifier.innerText();
  console.log(`¡ÉXITO! Sesión iniciada para: ${name}`);

  // 4. Guardar sesión
  await page.context().storageState({ path: authFile });
  console.log("--> Archivo de sesión guardado correctamente.");
});