# PROMPT PARA BOLT — Corrección visual del popover de comentarios

## CONTEXTO

Aplicación QuoteAI / Cotizador (React + Vite + TypeScript + TailwindCSS).
La funcionalidad de comentarios por línea en la pantalla **"Validar productos"**
YA FUNCIONA correctamente (guarda y persiste en Supabase). NO se toca su lógica.

El problema es EXCLUSIVAMENTE VISUAL: al hacer clic en el icono de comentario
(que está en la columna ACCIONES, la última de la tabla, pegada al borde
derecho), el popover con el textarea:

1. Se desborda por el borde derecho de la pantalla y queda CORTADO
   (el texto y el contador de caracteres se alcanzan a ver a medias).
2. Se encima sobre las filas inferiores de la tabla sin suficiente contraste:
   no tiene fondo sólido visible, ni sombra, ni borde claro, por lo que se
   confunde con el contenido de atrás.
3. Queda "chueco"/desalineado respecto al icono que lo abrió.

## CORRECCIÓN REQUERIDA

Modifica ÚNICAMENTE el componente del popover de comentarios (posicionamiento
y estilos). Nada de lógica de guardado, nada de otras pantallas.

### 1. Posicionamiento inteligente

- El popover debe abrirse hacia la IZQUIERDA del icono (alineado al borde
  derecho del popover con el icono, abriéndose hacia adentro de la tabla),
  porque el icono está en la última columna y a la derecha no hay espacio.
- Verticalmente: abrir hacia abajo por defecto, pero si la fila está cerca
  del final del viewport, abrir hacia arriba (flip automático).
- El popover NUNCA debe quedar cortado por el viewport ni por contenedores
  con `overflow: hidden` / `overflow: auto`. Si la tabla tiene un contenedor
  con overflow (por ejemplo para el scroll horizontal), renderiza el popover
  en un **portal** (`createPortal` a `document.body`) con `position: fixed`,
  calculando la posición a partir de `getBoundingClientRect()` del icono.
  Esta es la solución robusta preferida.
- Al hacer scroll o cambiar el tamaño de la ventana con el popover abierto,
  puede simplemente cerrarse (opción sencilla y aceptable).

### 2. Estilos para visibilidad

- Fondo sólido blanco (`bg-white`), SIN transparencia.
- Sombra clara para separarlo del contenido: `shadow-lg` o `shadow-xl`.
- Borde sutil: `border border-gray-200`, esquinas `rounded-lg`.
- `z-index` alto para quedar por encima de la tabla y de cualquier fila
  (`z-50` o superior; si hay otros elementos con z-index alto, ajústalo
  para que el popover siempre gane).
- Ancho fijo cómodo: aprox. `w-80` (320px), para que el textarea y el
  contador `n/200` se vean completos.
- Estructura interna:
  - Título pequeño: **"Comentario de línea"** (`text-sm font-semibold`, #032D60).
  - Textarea de 3–4 renglones, `resize-none`, con el placeholder existente.
  - Contador `n/200` abajo a la izquierda (`text-xs text-gray-400`).
  - Botones **"Cancelar"** (secundario) y **"Guardar"** (primario #0176D3)
    abajo a la derecha.
- Cerrar con: clic fuera del popover, tecla Escape, o botón Cancelar.
- Fuente Manrope y paleta existente (#0176D3 / #032D60), copy en español de México.

### 3. Consistencia

- El mismo popover corregido debe usarse en TODAS las filas (con coincidencia,
  sin coincidencia e ignoradas), incluyendo la primera y la última fila de la
  tabla (probar que en la última fila no se corte por abajo).

## PROHIBIDO

- PROHIBIDO cambiar la lógica de guardado/carga de comentarios (update a
  `job_lines.comentario` queda exactamente igual).
- PROHIBIDO tocar el icono de comentario existente, su estado activo, ni la
  visualización del comentario debajo del producto encontrado.
- PROHIBIDO tocar la generación del PDF.
- PROHIBIDO tocar los botones Editar / Ignorar / Restaurar, los contadores del
  encabezado, o cualquier otra parte de la pantalla de validación.
- PROHIBIDO tocar el flujo Docling / n8n / Railway, el dropzone,
  `mapN8nToReviewData()`, la tabla `products`, o la navegación (state machine
  interno, NO React Router).
- PROHIBIDO ejecutar SQL o crear migraciones.
- PROHIBIDO refactorizar componentes no relacionados.

## CRITERIOS DE ACEPTACIÓN

1. Abro el comentario en cualquier fila → el popover aparece COMPLETO, hacia
   la izquierda del icono, sin cortarse por el borde derecho de la pantalla.
2. El popover tiene fondo blanco sólido, sombra y borde: se distingue
   claramente de las filas que quedan detrás.
3. En la última fila visible de la tabla, el popover se abre hacia arriba (o
   se reposiciona) y no queda cortado por abajo.
4. Textarea, contador n/200 y botones Guardar/Cancelar se ven completos.
5. Escape y clic fuera cierran el popover sin guardar.
6. Guardar sigue funcionando igual que antes (persiste en Supabase y el
   comentario aparece en gris debajo del producto encontrado).
