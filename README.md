# Canville · Versión administrativa funcional

App de control administrativo (clientes, expedientes, documentos, tareas y proyectos) con pantallas de
movimientos, presupuestos, nóminas, fiscal, resultados y planes. Hecha con **Expo / React Native** y una
vista web adaptable: el mismo código corre en navegador (PC y celular), Android e iOS.

## Ejecutar
```bash
npm install
npm run web        # navegador
npm run android    # o: npm run ios  (requiere Expo Go o un build de desarrollo)
npm test           # pruebas de cálculos, CSV y permisos
npm run build:web  # exporta la versión web a dist/
```

## Cómo comenzar
La app abre en **demostración** (identificada como tal; los datos no se guardan). Para registrar información
real: **Configuración → Trabajar en este dispositivo**.

## Qué incluye
- **Clientes y expedientes**: ficha, checklist por categoría de documento, invitación al portal (registro local), vista previa de cliente.
- **Documentos**: subir archivo con categoría, cliente y periodo; estados Pendiente / En revisión / Completo; abrir y eliminar. «Completo» = expediente organizado, no certificación fiscal.
- **Tareas y proyectos**.
- **Movimientos**: ingresos y gastos en centavos; importación CSV (una fila inválida impide importar todo) y exportación CSV que neutraliza fórmulas de hoja de cálculo.
- **Presupuestos** con alertas (≥80 % cerca, >100 % excedido), **Nóminas** (neto = percepciones − deducciones capturadas), **Fiscal** (obligaciones, importes y fechas capturados, enlaces del SAT), **Resultados** (ingresos − gastos, tendencia de 6 meses).
- **Planes** orientativos (Esencial $499, Profesional $999, Empresarial $1,999 MXN/mes): guardan una propuesta, no cobran.

## Límites de esta versión (importante)
- Funciona **sin servidor**: los datos viven en el dispositivo (AsyncStorage; archivos en IndexedDB en web y en el directorio de documentos en móvil). Si se borra el almacenamiento del navegador, se pierden.
- **No incluye** inicio de sesión, espacios en nube, sincronización colaborativa ni portal de cliente con acceso remoto; requieren un backend.
- La vista previa de cliente simula el portal localmente y no modifica permisos reales.
- Nómina **no** calcula ISR, subsidio, IMSS ni INFONAVIT. Fiscal **no** presenta declaraciones ni valida XML/estatus SAT. No sustituye a un contador.
- No se generó build nativo (APK/AAB, iOS) ni se probó en dispositivo físico; solo la versión web se verificó en navegador.
