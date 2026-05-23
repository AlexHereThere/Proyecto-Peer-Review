import { test, expect } from './fixtures';

test('Flujo de navegación: usuario rol Administrador universal', async ({ page }) => {
  // 1. Navegación e inicialización del Frame anidado
  await page.goto('');

  const frame = page
    .locator('iframe[title="Evaluapares UABC"]').contentFrame()
    .locator('iframe[title="Evaluapares UABC"]').contentFrame();

  const waitContenido = async () => await frame.locator('#contenido').waitFor();

  // 2. Verificación inicial en el Panel de Administración
  // CORRECCIÓN: Evitamos 'h4' genérico usando getByRole('heading') específico
  await expect(frame.getByRole('heading', { name: 'Panel de Administración' })).toBeVisible();
  await expect(frame.getByRole('button', { name: 'Panel Admin' })).toBeVisible();
  
  // Validación de usuario universal (sin nombres fijos)
  await expect(frame.locator('#contenido')).not.toBeEmpty(); 
  await expect(frame.getByRole('cell')).toContainText('No hay documentos registrados.');

  // 3. Abrir y cerrar el modal de Gestionar Usuarios
  await frame.getByRole('button', { name: 'Gestionar Usuarios' }).click();
  await expect(frame.locator('#modalUsuariosLabel')).toContainText('Control de Privilegios de Acceso');
  await frame.getByRole('button', { name: 'Cerrar' }).click();

  // 4. Acción de actualizar documentos en el panel
  await frame.getByRole('button', { name: 'Actualizar' }).click();
  await expect(frame.getByRole('cell')).toContainText('Cargando documentos...');
  // Esperar a que termine la carga de documentos
  await expect(frame.getByRole('cell')).not.toContainText('Cargando documentos...', { timeout: 15000 });

  // 5. Ir a Inicio y verificar tarjetas dinámicas
  await frame.getByRole('button', { name: 'Inicio' }).click();
  await waitContenido();
  await expect(frame.locator('#usernameHome')).toBeVisible();
  await expect(frame.locator('#usernameHome')).not.toBeEmpty();
  await expect(frame.locator('#cardTitleDinamico')).toContainText('Administración');

  // 6. Navegación a Mi Cuenta y validación del Rol Admin
  await frame.getByRole('button', { name: 'Mi cuenta' }).click();
  await waitContenido();
  
  // Datos de perfil universales (visibilidad y formato de correo)
  await expect(frame.locator('#u-nombre')).toBeVisible();
  await expect(frame.locator('#u-nombre')).not.toBeEmpty();
  await expect(frame.getByText(/@uabc\.edu\.mx/i)).toBeVisible();
  
  // Estadísticas del Administrador
  await expect(frame.locator('small')).toContainText('Admin');
  await expect(frame.locator('#card-stats-admin')).toContainText('Trabajos en Sistema');

  // 7. Regresar a Inicio y acceder mediante el botón dinámico corporativo
  await frame.getByRole('button', { name: 'Inicio' }).click();
  await waitContenido();
  await expect(frame.locator('#usernameHome')).toBeVisible();
  await expect(frame.locator('#cardTitleDinamico')).toContainText('Administración');
  await frame.locator('#cardBtnDinamico').click();
  await waitContenido();
  
  // CORRECCIÓN FINAL: Validación de destino usando el encabezado exacto
  await expect(frame.getByRole('heading', { name: 'Panel de Administración' })).toBeVisible();
});

test('Flujo de administración: gestión de privilegios y reactividad de roles universal', async ({ page }) => {
  // 1. Navegación e inicialización del Frame anidado
  await page.goto('');

  const frame = page
    .locator('iframe[title="Evaluapares UABC"]').contentFrame()
    .locator('iframe[title="Evaluapares UABC"]').contentFrame();

  const waitContenido = async () => await frame.locator('#contenido').waitFor();

  // 2. Capturar el nombre del usuario logueado de forma dinámica
  await expect(frame.getByRole('heading', { name: 'Panel de Administración' })).toBeVisible();
  
  const nombreAdmin = await frame.getByRole('heading').first().innerText();

  await expect(frame.locator('#btnAdmin')).toContainText('Panel Admin');
  await expect(frame.getByRole('cell')).toContainText('No hay documentos registrados.');

  // 3. Actualización de documentos
  await frame.getByRole('button', { name: 'Actualizar' }).click();
  await expect(frame.getByRole('cell')).toContainText('Cargando documentos...');
  await expect(frame.getByRole('cell')).not.toContainText('Cargando documentos...', { timeout: 15000 });

  // 4. Abrir Gestión de Usuarios y activar Rol Autor
  await frame.getByRole('button', { name: 'Gestionar Usuarios' }).click();
  await expect(frame.locator('#modalUsuariosLabel')).toContainText('Control de Privilegios de Acceso');
  
  // Esperar a que la tabla cargue sus filas con checkboxes
  await frame.locator('tr:has(input[type="checkbox"])').getByRole('checkbox').first().waitFor({ state: 'visible', timeout: 20000 });

  const filaUsuario = frame.locator('tr').filter({ hasText: nombreAdmin }); 
  
  // Marcamos el rol de 'Autor' 
  await filaUsuario.getByRole('checkbox').nth(0).check(); 
  await frame.getByRole('button', { name: 'Cerrar' }).click();

  await frame.getByRole('button', { name: 'Inicio' }).click();
  await waitContenido();
  
  // Verificar reactividad: El botón 'Mis Documentos' debe ser visible
  await expect(frame.getByRole('button', { name: 'Mis Documentos' })).toBeVisible({ timeout: 10000 });

  // 5. Modificar privilegios (Quitar Autor, Activar Revisor)
  await frame.getByRole('button', { name: 'Panel Admin' }).click();
  await waitContenido();

  await frame.getByRole('button', { name: 'Gestionar Usuarios' }).click();
  await expect(frame.locator('#modalUsuariosLabel')).toContainText('Control de Privilegios de Acceso');
  await frame.locator('tr:has(input[type="checkbox"])').getByRole('checkbox').first().waitFor({ state: 'visible' });
  
  // Apuntamos a tu fila en este paso
  const filaUsuarioPaso5 = frame.locator('tr').filter({ hasText: nombreAdmin });
  await filaUsuarioPaso5.getByRole('checkbox').nth(0).uncheck(); // Quitar Autor
  await filaUsuarioPaso5.getByRole('checkbox').nth(1).check();   // Activar Revisor
  await frame.getByRole('button', { name: 'Cerrar' }).click();
  
  // Refrescar yendo a Inicio
  await frame.getByRole('button', { name: 'Inicio' }).click();
  await waitContenido();
  
  // Verificar reactividad: Ahora se debe ver 'Revisiones Asignadas'
  await expect(frame.getByRole('button', { name: 'Revisiones Asignadas' })).toBeVisible({ timeout: 10000 });

  // 6. Activar múltiples roles (Autor + Revisor)
  await frame.getByRole('button', { name: 'Panel Admin' }).click();
  await waitContenido();

  await frame.getByRole('button', { name: 'Gestionar Usuarios' }).click();
  await expect(frame.locator('#modalUsuariosLabel')).toContainText('Control de Privilegios de Acceso');
  await frame.locator('tr:has(input[type="checkbox"])').getByRole('checkbox').first().waitFor({ state: 'visible' });
  
  const filaUsuarioPaso6 = frame.locator('tr').filter({ hasText: nombreAdmin });
  await filaUsuarioPaso6.getByRole('checkbox').nth(0).check(); // Volver a activar Autor sin quitar Revisor
  
  // Validación Universal de formato de correo de la UABC
  await expect(frame.getByText(/Roles de [a-zA-Z0-9._%+-]+@uabc\.edu\.mx/i)).toBeVisible();
  await frame.getByRole('button', { name: 'Cerrar' }).click();

  // Refrescar yendo a Inicio
  await frame.getByRole('button', { name: 'Inicio' }).click();
  await waitContenido();

  // Verificar la coexistencia de todos los botones debido al Multi-rol
  await expect(frame.getByRole('button', { name: 'Mis Documentos' })).toBeVisible();
  await expect(frame.getByRole('button', { name: 'Revisiones Asignadas' })).toBeVisible();
  await expect(frame.getByRole('button', { name: 'Panel Admin' })).toBeVisible();

  // 7. Limpieza de privilegios extras para regresar al Administrador a su estado base
  await frame.getByRole('button', { name: 'Panel Admin' }).click();
  await waitContenido();

  await frame.getByRole('button', { name: 'Gestionar Usuarios' }).click();
  await frame.locator('tr:has(input[type="checkbox"])').getByRole('checkbox').first().waitFor({ state: 'visible' });
  
  const filaUsuarioPaso7 = frame.locator('tr').filter({ hasText: nombreAdmin });
  await filaUsuarioPaso7.getByRole('checkbox').nth(0).uncheck(); // Desmarcar Autor
  await filaUsuarioPaso7.getByRole('checkbox').nth(1).uncheck(); // Desmarcar Revisor
  await frame.getByRole('button', { name: 'Cerrar' }).click();

  // Refrescar final yendo a Inicio
  await frame.getByRole('button', { name: 'Inicio' }).click();
  await waitContenido();

  // 8. Verificación final: Regresamos al Panel Admin y comprobamos que todo quedó limpio
  await frame.getByRole('button', { name: 'Panel Admin' }).click();
  await waitContenido();
  await expect(frame.getByRole('heading', { name: 'Panel de Administración' })).toBeVisible();
  
  // Los accesos extra ya no deben estar visibles
  await expect(frame.getByRole('button', { name: 'Mis Documentos' })).not.toBeVisible();
  await expect(frame.getByRole('button', { name: 'Revisiones Asignadas' })).not.toBeVisible();
});