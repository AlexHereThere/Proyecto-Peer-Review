import { test, expect } from './fixtures';

test('Verifica el nombre del usuario', async ({ appPage }) => {
  // appPage ya es el frame, no tienes que hacer nada más
  await expect(appPage.locator('#userName')).toBeVisible({ timeout: 20000 });
});