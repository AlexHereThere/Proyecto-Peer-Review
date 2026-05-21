// support/fixtures.js
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  appPage: async ({ page }, use) => {
    await page.goto(''); // Usando la baseURL del config
    
    // Creamos el localizador del frame anidado (lo que descubrió el codegen)
    const topFrame = page.frameLocator('iframe[title="Evaluapares UABC"]');
    const innerFrame = topFrame.frameLocator('iframe[title="Evaluapares UABC"]');
    
    // Esperamos a que el contenido cargue antes de entregar el frame al test
    await innerFrame.locator('#userName').waitFor({ state: 'visible' });

    await use(innerFrame);
  },
});

export { expect };