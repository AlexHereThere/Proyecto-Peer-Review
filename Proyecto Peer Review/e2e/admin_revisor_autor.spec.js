import { test, expect } from './fixtures';
import path from 'path';

test('Flujo de navegación completo: Usuario con Triple Rol Simultáneo (Admin, Revisor y Autor) universal', async ({ page }) => {
  // 1. Navegación e inicialización del Frame anidado
  await page.goto('');

  const frame = page
    .locator('iframe[title="Evaluapares UABC"]').contentFrame()
    .locator('iframe[title="Evaluapares UABC"]').contentFrame();

  const waitContenido = async () => await frame.locator('#contenido').waitFor();

  // 2. Verificaciones iniciales en el Panel de Administración (Vista Admin Base)
  // CORRECCIÓN STRICT MODE: Reemplazo de h4 por heading específico
  await expect(frame.getByRole('heading', { name: 'Panel de Administración' })).toBeVisible();
  
  // Aislamos la tabla general de administración para evitar conflictos con otras cargas del DOM
  const tablaDocsAdmin = frame.locator('#tablaDocumentosGeneral, #contenido table').first();
  await expect(tablaDocsAdmin.getByRole('cell')).toContainText('No hay documentos registrados.');

  // 3. Interacción con el Modal de Gestión de Usuarios
  await frame.getByRole('button', { name: 'Gestionar Usuarios' }).click();
  await expect(frame.locator('#modalUsuariosLabel')).toContainText('Control de Privilegios de Acceso');
  await frame.getByRole('button', { name: 'Cerrar' }).click();

  // 4. Verificación de la barra de navegación: Coexistencia del Triple Rol
  await expect(frame.getByRole('button', { name: 'Mis Documentos' })).toBeVisible();
  await expect(frame.getByRole('button', { name: 'Revisiones Asignadas' })).toBeVisible();
  await expect(frame.getByRole('button', { name: 'Panel Admin' })).toBeVisible();

  // 5. Pantalla de Inicio y verificación de la Tarjeta Dinámica Principal
  await frame.getByRole('button', { name: 'Inicio' }).click();
  await waitContenido();
  await expect(frame.locator('#usernameHome')).toBeVisible();
  await expect(frame.locator('#cardTitleDinamico')).toContainText('Mis Revisiones');

  // 6. Navegación a Mi Cuenta: Validación Exhaustiva del Triple Perfil
  await frame.getByRole('button', { name: 'Mi cuenta' }).click();
  await waitContenido();
  
  await expect(frame.locator('#contenido')).toContainText('Datos de Usuario');
  await expect(frame.locator('#u-nombre')).toBeVisible();
  await expect(frame.locator('#u-nombre')).not.toBeEmpty();
  await expect(frame.getByText(/@uabc\.edu\.mx/i)).toBeVisible(); // Validación por Regex de correo universal

  // Validar presencia de los 3 badges de rol simultáneos
  await expect(frame.locator('#u-roles-container')).toContainText('Admin');
  await expect(frame.locator('#u-roles-container')).toContainText('Revisor');
  await expect(frame.locator('#u-roles-container')).toContainText('Autor');

  // Validar presencia de los 3 bloques de estadísticas independientes
  await expect(frame.locator('#card-stats-autor')).toContainText('Mis Trabajos');
  await expect(frame.locator('#card-stats-revisor')).toContainText('Revisiones');
  await expect(frame.locator('#card-stats-admin')).toContainText('Trabajos en Sistema');

  // 7. Auditoría de Sección: Mis Documentos (Entorno de Autor)
  await frame.getByRole('button', { name: 'Mis Documentos' }).click();
  await waitContenido();
  // CORRECCIÓN STRICT MODE: Evitamos h4 genérico usando heading específico
  await expect(frame.getByRole('heading', { name: 'Mis Documentos' })).toBeVisible();
  
  const tablaDocsAutor = frame.locator('#tablaDocumentos, #contenido table').first();
  await expect(tablaDocsAutor.getByRole('cell', { name: 'No hay documentos registrados.' })).toBeVisible();
  await expect(tablaDocsAutor.getByRole('cell')).toContainText('No hay documentos registrados.');

  // 8. Auditoría de Sección: Revisiones Asignadas (Entorno de Revisor)
  await frame.getByRole('button', { name: 'Revisiones Asignadas' }).click();
  await waitContenido();
  // CORRECCIÓN STRICT MODE: Reemplazo de h4 genérico por heading específico
  await expect(frame.getByRole('heading', { name: 'Revisiones Asignadas' })).toBeVisible();
  
  const tablaRevisiones = frame.locator('#tablaRevisiones, #contenido table').first();
  await expect(tablaRevisiones.getByRole('cell')).toContainText('No hay evaluaciones asignadas.');

  // Sincronizar asignaciones con el backend de Google
  await frame.getByRole('button', { name: 'Actualizar' }).click();
  await expect(tablaRevisiones.getByRole('cell')).toContainText('Consultando asignaciones...');
  await expect(tablaRevisiones.getByRole('cell')).not.toContainText('Consultando asignaciones...', { timeout: 15000 });

  // 9. Cierre del ciclo: Regreso seguro al Panel de Administración
  await frame.getByRole('button', { name: 'Panel Admin' }).click();
  await waitContenido();
  await expect(frame.getByRole('heading', { name: 'Panel de Administración' })).toBeVisible();
});

test('Flujo de integración avanzado: Ciclo completo cooperativo Multi-rol universal (Rechazo de Revisión)', async ({ page }) => {
  // 1. Navegación e inicialización del Frame anidado
  await page.goto('');

  const frame = page
    .locator('iframe[title="Evaluapares UABC"]').contentFrame()
    .locator('iframe[title="Evaluapares UABC"]').contentFrame();

  const waitContenido = async () => await frame.locator('#contenido').waitFor();
  const nombreArchivo = 'FEP - Avance 2 de Proyecto.pdf';

  // 2. Verificaciones iniciales en el Panel de Administración (Vista Admin)
  await expect(frame.getByRole('heading', { name: 'Panel de Administración' })).toBeVisible();
  await expect(frame.getByRole('heading', { name: 'Alejandro Castro Renteria' })).toBeVisible();
  
  const tablaDocsAdmin = frame.locator('#tablaDocumentosGeneral, #contenido table').first();
  await expect(tablaDocsAdmin.getByRole('cell')).toContainText('No hay documentos registrados.');

  // Confirmar coexistencia de accesos cruzados debido al multi-rol asignado
  await expect(frame.getByRole('button', { name: 'Mis Documentos' })).toBeVisible();
  await expect(frame.getByRole('button', { name: 'Revisiones Asignadas' })).toBeVisible();
  await expect(frame.getByRole('button', { name: 'Panel Admin' })).toBeVisible();

  // 3. Navegación a Mis Documentos (Vista Autor) y subida de archivo
  await frame.getByRole('button', { name: 'Mis Documentos' }).click();
  await waitContenido();
  await expect(frame.getByRole('heading', { name: 'Mis Documentos' })).toBeVisible();
  
  const tablaDocsAutor = frame.locator('#tablaDocumentos, #contenido table').first();
  await expect(tablaDocsAutor.getByRole('cell')).toContainText('No hay documentos registrados.');

  await frame.getByRole('button', { name: 'Nuevo Documento' }).click();
  await expect(frame.locator('h5')).toContainText('Subir Trabajo');
  
  // Carga directa del documento sin clics invasivos al input nativo
  await frame.locator('input[type="file"]').setInputFiles(path.resolve(__dirname, `Doc_Prueba/${nombreArchivo}`));
  await frame.getByRole('button', { name: 'Subir Documento' }).click();
  
  // Sincronización del estado de envío asíncrono
  await expect(frame.locator('#mensajeSubida')).toContainText('Enviando...');
  await expect(frame.locator('#mensajeSubida')).not.toBeVisible({ timeout: 15000 });
  await expect(tablaDocsAutor.getByRole('cell', { name: nombreArchivo })).toBeVisible();

  // 4. Regreso a Administración para Gestión de Flujo (Vista Admin)
  await frame.getByRole('button', { name: 'Panel Admin' }).click();
  await waitContenido();
  await expect(tablaDocsAdmin.getByRole('cell', { name: nombreArchivo })).toBeVisible({ timeout: 10000 });

  // 5. Gestión de Evaluadores dentro del Modal de Asignación
  await frame.getByRole('button', { name: 'Asignar Revisor' }).click();
  await expect(frame.locator('#modalAsignarLabel')).toContainText('Asignar Evaluador Técnico');
  await expect(frame.getByLabel('Asignar Evaluador Técnico').getByText('Alejandro Castro Renteria')).toBeVisible();
  
  // Primera asignación simulada
  await frame.locator('#listaRevisoresSistema').getByRole('button', { name: 'Asignar' }).first().click();
  await expect(frame.getByTitle('a1183297@uabc.edu.mx')).toBeVisible();
  
  // Cancelación / Desasignación mediante botón 'X'
  await frame.getByRole('button', { name: 'X' }).click();
  await expect(frame.locator('#listaRevisoresAsignados')).toContainText('Sin revisores en esta versión.');
  
  // Asignación definitiva para el flujo de pruebas
  await frame.locator('#listaRevisoresSistema').getByRole('button', { name: 'Asignar' }).first().click();
  await expect(frame.locator('#listaRevisoresAsignados')).toContainText('Pendiente');
  await frame.getByRole('button', { name: 'Cerrar Ventana' }).click();

  // 6. Auditoría y Rechazo de la revisión asignada (Vista Revisor)
  await frame.getByRole('button', { name: 'Revisiones Asignadas' }).click();
  await waitContenido();
  await expect(frame.getByRole('heading', { name: 'Revisiones Asignadas' })).toBeVisible();
  
  const tablaRevisiones = frame.locator('#tablaRevisiones, #contenido table').first();
  await expect(tablaRevisiones.getByRole('cell', { name: 'V1_FEP - Avance 2 de Proyecto' })).toBeVisible();
  await expect(tablaRevisiones).toContainText('Anónimo (Autor)');
  
  // Acción de Rechazar asignación
  await frame.getByRole('button', { name: 'Rechazar' }).click();
  
  // Esto le da tiempo al backend de Google de borrar la fila antes de que busquemos el texto de "No hay..."
  await expect(tablaRevisiones.getByRole('cell', { name: 'V1_FEP - Avance 2 de Proyecto' })).not.toBeVisible({ timeout: 20000 });

  // Ahora que la fila desapareció, el texto esperado pasará limpio sin conflictos de Strict Mode
  await expect(tablaRevisiones.getByRole('cell')).toContainText('No hay evaluaciones asignadas.');

  // 7. Navegación a Mis Documentos para auditoría de detalles (Vista Autor)
  await frame.getByRole('button', { name: 'Panel Admin' }).click();
  await waitContenido();
  await frame.getByRole('button', { name: 'Mis Documentos' }).click();
  await waitContenido();
  await expect(frame.getByRole('heading', { name: 'Mis Documentos' })).toBeVisible();
  
  // Inspección de visualización previa
  await frame.getByRole('button', { name: 'Ver Detalles' }).click();
  await waitContenido();
  await expect(frame.locator('#previewPDF').getByRole('img')).toBeVisible();

  // 8. Eliminación permanente del archivo para limpieza del sistema
  await frame.getByRole('button', { name: 'Eliminar Versión' }).click();
  await expect(frame.locator('#modalConfirmarEliminar')).toContainText('Confirmar Eliminación');
  await frame.getByRole('button', { name: 'Eliminar Definitivamente' }).click();
  
  // Esperar a que el backend de Google Sheets limpie los registros
  await expect(frame.locator('#statusEliminar')).toContainText('Eliminando registros de versión...');
  await expect(frame.locator('#statusEliminar')).not.toBeVisible({ timeout: 15000 });
  await expect(tablaDocsAutor.getByRole('cell')).toContainText('No hay documentos registrados.');

  // 9. Comprobación de limpieza final en la base del Panel Admin
  await frame.getByRole('button', { name: 'Panel Admin' }).click();
  await waitContenido();
  await expect(frame.getByRole('heading', { name: 'Panel de Administración' })).toBeVisible();
  await expect(tablaDocsAdmin.getByRole('cell')).toContainText('No hay documentos registrados.');
});

test('Flujo de integración avanzado: Ciclo completo cooperativo Multi-rol universal (Aprobación de Revisión)', async ({ page }) => {
  // 1. Navegación e inicialización del Frame anidado
  await page.goto('');

  const frame = page
    .locator('iframe[title="Evaluapares UABC"]').contentFrame()
    .locator('iframe[title="Evaluapares UABC"]').contentFrame();

  const waitContenido = async () => await frame.locator('#contenido').waitFor();
  const nombreArchivo = 'FEP - Avance 2 de Proyecto.pdf';

  // 2. Verificaciones iniciales en el Panel de Administración (Vista Admin)
  await expect(frame.getByRole('heading', { name: 'Panel de Administración' })).toBeVisible();
  
  const tablaDocsAdmin = frame.locator('#tablaDocumentosGeneral, #contenido table').first();
  await expect(tablaDocsAdmin.locator('td').first()).toContainText('No hay documentos registrados.');

  // 3. Navegación a Mis Documentos (Vista Autor) y subida de archivo
  await frame.getByRole('button', { name: 'Mis Documentos' }).click();
  await waitContenido();
  await expect(frame.getByRole('heading', { name: 'Mis Documentos' })).toBeVisible();
  
  const tablaDocsAutor = frame.locator('#tablaDocumentos, #contenido table').first();
  await expect(tablaDocsAutor.locator('td').first()).toContainText('No hay documentos registrados.');

  await frame.getByRole('button', { name: 'Nuevo Documento' }).click();
  await expect(frame.locator('h5')).toContainText('Subir Trabajo');
  
  // Carga usando ruta absoluta dinámica
  await frame.locator('input[type="file"]').setInputFiles(path.resolve(__dirname, `Doc_Prueba/${nombreArchivo}`));
  await frame.getByRole('button', { name: 'Subir Documento' }).click();
  
  // Sincronización del estado de envío
  await expect(frame.locator('#mensajeSubida')).toContainText('Enviando...');
  await expect(frame.locator('#mensajeSubida')).not.toBeVisible({ timeout: 15000 });
  await expect(tablaDocsAutor.getByRole('cell', { name: nombreArchivo })).toBeVisible();

  // 4. Verificación de estadísticas iniciales (Vista Cuenta)
  await frame.getByRole('button', { name: 'Mi cuenta' }).click();
  await waitContenido();
  await expect(frame.locator('#stat-aut-borradores')).toContainText('1');
  await expect(frame.locator('#stat-adm-total')).toContainText('1');
  await expect(frame.locator('#stat-adm-pendiente')).toContainText('1');

  // 5. Gestión de Evaluadores (Vista Admin)
  await frame.getByRole('button', { name: 'Panel Admin' }).click();
  await waitContenido();
  await frame.getByRole('button', { name: 'Asignar Revisor' }).click();
  await expect(frame.locator('#modalAsignarLabel')).toContainText('Asignar Evaluador Técnico');
  
  // Asignación del revisor
  await frame.locator('#listaRevisoresSistema').getByRole('button', { name: 'Asignar' }).first().click();
  await expect(frame.locator('#listaRevisoresAsignados')).toContainText('Pendiente');
  await frame.getByRole('button', { name: 'Cerrar Ventana' }).click();

  // 6. Proceso de Aceptación y Evaluación del Documento (Vista Revisor)
  await frame.getByRole('button', { name: 'Revisiones Asignadas' }).click();
  await waitContenido();
  
  const tablaRevisiones = frame.locator('#tablaRevisiones, #contenido table').first();
  
  // Contenedor específico para aislar la fila de nuestra ejecución actual
  const nombreVersionAsignada = `V1_${nombreArchivo.replace('.pdf', '')}`;
  const filaDocumentoActual = tablaRevisiones.locator('tr', { hasText: nombreVersionAsignada });

  // Validamos nuestra fila específica antes de interactuar
  await expect(filaDocumentoActual).toBeVisible({ timeout: 15000 });
  await expect(filaDocumentoActual).toContainText('Anónimo (Autor)');
  
  // Aceptar asignación dentro de la fila correcta
  await filaDocumentoActual.getByRole('button', { name: 'Aceptar' }).click();
  await expect(filaDocumentoActual).toContainText('Asignado', { timeout: 15000 });
  
  // Iniciar la revisión
  await filaDocumentoActual.getByRole('button', { name: 'Iniciar Revisión' }).click();

  // Esperar a que la consulta intermedia del backend desaparezca del DOM global de la tabla
  await expect(tablaRevisiones).not.toContainText('Consultando asignaciones...', { timeout: 15000 });
  await expect(filaDocumentoActual).toContainText('En Revisión', { timeout: 10000 });
  
  // Entrar al entorno de evaluación
  await filaDocumentoActual.getByRole('button', { name: 'Evaluar Documento' }).click();
  await waitContenido();
  await expect(frame.locator('#contenido')).toContainText('Espacio de Evaluación');
  
  // Emitir dictamen aprobatorio definitivo
  await frame.getByRole('button', { name: 'Aprobar Versión de Forma' }).click();
  await expect(frame.locator('#modalTitle')).toContainText('Confirmar Dictamen Definitivo');
  await frame.getByRole('button', { name: 'Confirmar Envió' }).click();
  
  await expect(frame.locator('#modalTitle')).toContainText('Evaluación Registrada', { timeout: 15000 });
  await frame.getByRole('button', { name: 'Entendido' }).click();
  await expect(tablaRevisiones).toContainText('Aprobado');

  // 7. Auditoría de Estadísticas Post-Aprobación
  await frame.getByRole('button', { name: 'Mi cuenta' }).click();
  await waitContenido();
  await expect(frame.locator('#stat-aut-aceptados')).toContainText('1');
  await expect(frame.locator('#stat-rev-completados')).toContainText('1');
  await expect(frame.locator('#stat-adm-aprobados')).toContainText('1');

  // 8. Validación de visualización de observaciones y PDF Embed (Vista Revisor / Autor)
  await frame.getByRole('button', { name: 'Revisiones Asignadas' }).click();
  await waitContenido();
  await frame.getByRole('button', { name: 'Ver Evaluación' }).click();
  await waitContenido();
  await expect(frame.locator('iframe[title="PDF Embed API"]').contentFrame().locator('.CommentsView__commentsHighlight___BDn6U').first()).toBeVisible({ timeout: 15000 });
  
  await frame.getByRole('button', { name: 'Volver al Listado' }).click();
  await waitContenido();

  // Inspección desde la perspectiva del Autor
  await frame.getByRole('button', { name: 'Mis Documentos' }).click();
  await waitContenido();
  await frame.getByRole('button', { name: 'Ver Detalles' }).click();
  await waitContenido();
  await expect(frame.locator('#tablaRevisiones')).toContainText('Anónimo (Revisor)');
  await expect(frame.locator('#previewPDF').getByRole('img')).toBeVisible();
  
  await frame.getByRole('button', { name: 'Ver observaciones' }).click();
  await waitContenido();
  await expect(frame.locator('iframe[title="PDF Embed API"]').contentFrame().locator('.CommentsView__commentsHighlight___BDn6U').first()).toBeVisible({ timeout: 15000 });
  
  await frame.getByRole('button', { name: 'Volver' }).click();
  await waitContenido();

  // 9. Eliminación permanente y Limpieza del Sistema
  await frame.getByRole('button', { name: 'Eliminar Versión' }).click();
  await expect(frame.locator('#modalConfirmarEliminar')).toContainText('Confirmar Eliminación');
  await frame.getByRole('button', { name: 'Eliminar Definitivamente' }).click();
  
  // Esperas de destrucción para evitar retrasos asíncronos en Google Drive/Sheets
  await expect(frame.locator('#statusEliminar')).toContainText('Eliminando registros de versión...');
  await expect(frame.locator('#statusEliminar')).not.toBeVisible({ timeout: 20000 });
  
  // Validamos remoción limpia en vista Autor
  await expect(tablaDocsAutor.getByRole('cell', { name: nombreArchivo })).not.toBeVisible({ timeout: 20000 });
  await expect(tablaDocsAutor.locator('td').first()).toContainText('No hay documentos registrados.');

  // 10. Verificación final de limpieza en la base del Panel Admin
  await frame.getByRole('button', { name: 'Panel Admin' }).click();
  await waitContenido();
  await expect(frame.getByRole('heading', { name: 'Panel de Administración' })).toBeVisible();
  
  // Espera rigurosa del fin de carga asíncrona general
  await expect(frame.locator('html')).not.toContainText('Cargando documentos...', { timeout: 20000 });
  await expect(tablaDocsAdmin.getByRole('cell', { name: nombreArchivo })).not.toBeVisible({ timeout: 10000 });
  await expect(tablaDocsAdmin.locator('td').first()).toContainText('No hay documentos registrados.');

  // 11. Verificación final de contadores en Cero
  await frame.getByRole('button', { name: 'Mi cuenta' }).click();
  await waitContenido();
  
  const stats = [
    '#stat-aut-revision', '#stat-aut-borradores', '#stat-aut-aceptados', '#stat-aut-corregir',
    '#stat-rev-completados', '#stat-rev-progreso', '#stat-rev-espera',
    '#stat-adm-pendiente', '#stat-adm-aprobados', '#stat-adm-revision', '#stat-adm-total'
  ];
  for (const stat of stats) {
    await expect(frame.locator(stat)).toContainText('0');
  }
});

test('Flujo de integración avanzado: Ciclo completo cooperativo Multi-rol universal (Dictamen para Corrección)', async ({ page }) => {
  // 1. Navegación e inicialización del Frame anidado
  await page.goto('https://script.google.com/a/macros/uabc.edu.mx/s/AKfycby8CB-gSLuJOJg3z9MaB8ogP_0uWhwrLqdXY7Nqxiu-KNpxDZ50qICezA34Mxhkki1i/exec');

  const frame = page
    .locator('iframe[title="Evaluapares UABC"]').contentFrame()
    .locator('iframe[title="Evaluapares UABC"]').contentFrame();

  const waitContenido = async () => await frame.locator('#contenido').waitFor();
  const nombreArchivo = 'FEP - Avance 2 de Proyecto.pdf';

  // 2. Verificaciones iniciales en el Panel de Administración (Vista Admin)
  await expect(frame.getByRole('heading', { name: 'Panel de Administración' })).toBeVisible();
  
  const tablaDocsAdmin = frame.locator('#tablaDocumentosGeneral, #contenido table').first();
  await expect(tablaDocsAdmin.locator('td').first()).toContainText('No hay documentos registrados.');

  // 3. Navegación a Mis Documentos (Vista Autor) y subida de archivo
  await frame.getByRole('button', { name: 'Mis Documentos' }).click();
  await waitContenido();
  await expect(frame.getByRole('heading', { name: 'Mis Documentos' })).toBeVisible();
  
  const tablaDocsAutor = frame.locator('#tablaDocumentos, #contenido table').first();
  await expect(tablaDocsAutor.locator('td').first()).toContainText('No hay documentos registrados.');

  await frame.getByRole('button', { name: 'Nuevo Documento' }).click();
  await expect(frame.locator('h5')).toContainText('Subir Trabajo');
  
  // Carga limpia usando la ruta absoluta dinámica
  await frame.locator('input[type="file"]').setInputFiles(path.resolve(__dirname, `Doc_Prueba/${nombreArchivo}`));
  await frame.getByRole('button', { name: 'Subir Documento' }).click();
  
  // Sincronización del estado de envío asíncrono
  await expect(frame.locator('#mensajeSubida')).toContainText('Enviando...');
  await expect(frame.locator('#mensajeSubida')).not.toBeVisible({ timeout: 15000 });
  await expect(tablaDocsAutor.getByRole('cell', { name: nombreArchivo })).toBeVisible();

  // 4. Gestión y Configuración de Evaluadores (Vista Admin)
  await frame.getByRole('button', { name: 'Panel Admin' }).click();
  await waitContenido();
  await frame.getByRole('button', { name: 'Asignar Revisor' }).click();
  
  // Configuración del tipo de revisión dentro del modal
  await frame.locator('#tipoRevisionListaAdmin').selectOption('Simple Ciego');
  await expect(frame.locator('#modalAsignarLabel')).toContainText('Asignar Evaluador Técnico');
  
  // Ejecución de la asignación del revisor
  await frame.locator('#listaRevisoresSistema').getByRole('button', { name: 'Asignar' }).first().click();
  await expect(frame.locator('#listaRevisoresAsignados')).toContainText('Pendiente');
  await frame.getByRole('button', { name: 'Cerrar Ventana' }).click();

  // 5. Proceso de Aceptación y Evaluación con Comentarios (Vista Revisor)
  await frame.getByRole('button', { name: 'Revisiones Asignadas' }).click();
  await waitContenido();
  
  const tablaRevisiones = frame.locator('#tablaRevisiones, #contenido table').first();
  const nombreVersionAsignada = `V1_${nombreArchivo.replace('.pdf', '')}`;
  const filaDocumentoActual = tablaRevisiones.locator('tr', { hasText: nombreVersionAsignada });

  // Aislamiento de la fila para evitar Strict Mode
  await expect(filaDocumentoActual).toBeVisible({ timeout: 15000 });
  await filaDocumentoActual.getByRole('button', { name: 'Aceptar' }).click();
  await expect(filaDocumentoActual).toContainText('Asignado', { timeout: 15000 });
  
  // Inicio de auditoría activa
  await filaDocumentoActual.getByRole('button', { name: 'Iniciar Revisión' }).click();
  await expect(tablaRevisiones).not.toContainText('Consultando asignaciones...', { timeout: 15000 });
  await expect(filaDocumentoActual).toContainText('En Revisión', { timeout: 10000 });
  
  await filaDocumentoActual.getByRole('button', { name: 'Evaluar Documento' }).click();
  await waitContenido();
  await expect(frame.locator('#contenido')).toContainText('Espacio de Evaluación');

  // 6. Interacción interactiva con el SDK de PDF Embed API (Adobe)
  const adobeFrame = frame.locator('iframe[title="PDF Embed API"]').contentFrame();
  await expect(adobeFrame.locator('.CommentsView__commentsHighlight___BDn6U').first()).toBeVisible({ timeout: 15000 });
  
  // Inserción de observaciones en el panel lateral de Adobe
  await adobeFrame.getByTestId('skinny-rail-button-comments').getByRole('button', { name: 'Comments' }).click();
  await adobeFrame.getByTestId('editableDiv').click();
  await adobeFrame.getByTestId('editableDiv').fill('Help.');
  await adobeFrame.getByTestId('post_tool_button').click();
  
  // Emitir dictamen definitivo solicitando cambios (Correcciones requeridas)
  await expect(frame.locator('#btnFinalizar')).toContainText('Enviar Dictamen para Corrección (1)');
  await frame.getByRole('button', { name: 'Enviar Dictamen para Correcci' }).click();
  await expect(frame.locator('#modalTitle')).toContainText('Confirmar Dictamen Definitivo');
  await frame.getByRole('button', { name: 'Confirmar Envió' }).click();
  
  await expect(frame.locator('#modalTitle')).toContainText('Evaluación Registrada', { timeout: 15000 });
  await frame.getByRole('button', { name: 'Entendido' }).click();
  await expect(tablaRevisiones).toContainText('A Corregir');

  // 7. Auditoría de Indicadores de Estado Cruzados (Vista Mi Cuenta)
  await frame.getByRole('button', { name: 'Mi cuenta' }).click();
  await waitContenido();
  await expect(frame.locator('#stat-aut-corregir')).toContainText('1');
  await expect(frame.locator('#stat-rev-completados')).toContainText('1');
  await expect(frame.locator('#stat-adm-total')).toContainText('1');

  // 8. Inspección de Observaciones desde la perspectiva del Autor
  await frame.getByRole('button', { name: 'Mis Documentos' }).click();
  await waitContenido();
  
  // Sincronización para evitar evaluar datos desactualizados en la tabla de autor
  await expect(frame.locator('html')).not.toContainText('Cargando documentos...', { timeout: 15000 });
  
  // Definimos la fila específica del Autor para evitar conflictos de Strict Mode
  const filaAutorActual = tablaDocsAutor.locator('tr', { hasText: nombreArchivo });
  await expect(filaAutorActual).toContainText('A Corregir');
  
  await filaAutorActual.getByRole('button', { name: 'Ver Detalles' }).click();
  await waitContenido();
  await expect(frame.locator('#previewPDF').getByRole('img')).toBeVisible();
  await expect(frame.locator('#tablaRevisiones')).toContainText('Anónimo (Revisor)');
  
  // Validación de la persistencia de las anotaciones de Adobe para el Autor
  await frame.getByRole('button', { name: 'Ver observaciones' }).click();
  await waitContenido();
  
  // FIX: Se reemplazó frame.locator('h5') por validación dirigida al contenedor para evitar Strict Mode
  await expect(frame.locator('#contenido')).toContainText('Observaciones');
  await expect(adobeFrame.locator('.CommentsView__commentsHighlight___BDn6U').first()).toBeVisible({ timeout: 15000 });
  
  await frame.getByRole('button', { name: 'Volver' }).click();
  await waitContenido();
  await expect(frame.locator('#previewPDF').getByRole('img')).toBeVisible();

  // 9. Destrucción Permanente y Limpieza Sanitaria de Registros
  await frame.getByRole('button', { name: 'Eliminar Versión' }).click();
  await expect(frame.locator('#modalConfirmarEliminar')).toContainText('Confirmar Eliminación');
  await frame.getByRole('button', { name: 'Eliminar Definitivamente' }).click();
  
  // Garantizar el fin del ciclo de borrado en cascada de Google Drive / Sheets
  await expect(frame.locator('#statusEliminar')).toContainText('Eliminando registros de versión...');
  await expect(frame.locator('#statusEliminar')).not.toBeVisible({ timeout: 20000 });
  
  await expect(tablaDocsAutor.getByRole('cell', { name: nombreArchivo })).not.toBeVisible({ timeout: 15000 });
  await expect(tablaDocsAutor.locator('td').first()).toContainText('No hay documentos registrados.');

  // 10. Verificación Final en el Panel de Administración Principal
  await frame.getByRole('button', { name: 'Panel Admin' }).click();
  await waitContenido();
  await expect(frame.getByRole('heading', { name: 'Panel de Administración' })).toBeVisible();
  
  await expect(frame.locator('html')).not.toContainText('Cargando documentos...', { timeout: 20000 });
  await expect(tablaDocsAdmin.locator('td').first()).toContainText('No hay documentos registrados.');
});