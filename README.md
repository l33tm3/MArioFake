## Aero Adventure — Plataforma estilo Mario en Canvas

Juego en HTML5 Canvas con scroll lateral, bloques interactivos, enemigos simples, parallax y soporte de sprites tipo retro.

### Demo local
- Abre `index.html` en tu navegador (doble clic) o sirve la carpeta con un servidor estático.
- Recomendado para desarrollo: extensión Live Server o `npx serve .`.

### Controles
- Izquierda/Derecha: mover
- Z o Barra espaciadora: saltar y, en el aire, mantener para planear/volar mientras haya energía
- Shift o X: correr
- P: pausar/reanudar
- R: reiniciar
- En móviles aparecen botones táctiles y un botón de pantalla completa

### Características
- Scroll lateral con cámara siguiendo al jugador
- Barra de vuelo con energía recargable al tocar el suelo
- Bloques `?` que otorgan monedas y quedan vacíos; bloques de ladrillo sólidos
- Enemigos con patrulla básica; puedes pisarlos para eliminarlos
- Bandera de fin de nivel
- Fondo con parallax (carga `paisaje.png` o `paisaje.jpg`)
- Render sin suavizado para pixel art (image smoothing off)
- Controles en pantalla y modo de pantalla completa para móviles

### Sprites del jugador
- El archivo por defecto para el personaje es `image.png` (puedes reemplazarlo con tu sprite). Si usas `caminar.png`, renómbralo a `image.png` o ajusta el código.
- Por defecto se asume una grilla 4 columnas × 3 filas:
  - Caminar: fila 0 → frames `[0,1,2,3]`
  - Idle: `8` (fila 2, columna 0)
- Puedes ajustar en tiempo real desde la consola del navegador:


### Sprites de personajes
- Las carpetas dentro de `sprites/` (por ejemplo `daniela/`, `facundo/`, `martin/`) contienen sprites de prueba para otros personajes.
- Cada carpeta incluye `1.png` y `2.png` como fotogramas base. Para integrarlos, agrega una carpeta con el mismo esquema o reemplaza los archivos existentes.
- Ejemplo de carga desde JavaScript:

```js
const extra = new Image();
extra.src = 'sprites/daniela/1.png';
```

### Audio
- Pistas disponibles en `audio/`:
  - `main.mp3` – tema principal del menú.
  - `main2.mp3` – variante del tema principal.
  - `chact-select.mp3` – pantalla de selección de personaje.
  - `stage1.mp3` – música del primer nivel.
  - `battle1.mp3` – combate estándar.
  - `battle2.mp3` – combate alternativo.
  - `boss1.mp3` – jefe intermedio.
  - `boss2.mp3` – jefe final.
- Puedes reemplazar los archivos manteniendo el mismo nombre o ajustar las rutas en el código para usar otros.
- Ejemplo de carga:

```js
const music = new Audio('audio/main.mp3');
music.loop = true;
music.play();
```

### Fondo (parallax)
- Coloca tu imagen como `paisaje.png` (fallback automático a `paisaje.jpg`).

### Física y vuelo
- Parámetros principales (en `js/game.js` dentro de `state.player`): `gravity`, `jump`, `flyPower`, `maxAscendSpeed`.
- Energía de vuelo: `flight`, `flightMax` (se muestra en HUD y se recarga en el suelo).

### Estructura
- `index.html`: estructura base que enlaza a los archivos de estilos y scripts
- `css/styles.css`: estilos del juego
- `js/game.js`: lógica del juego
- `image.png`: spritesheet del jugador
- `paisaje.png`/`paisaje.jpg`: fondo con parallax
- `caminar.png` (opcional): otro asset de ejemplo

### Desarrollo
1) Edita `index.html` y recarga el navegador.

### ¿Por qué considerar un motor de juego?
Si el proyecto crece, migrar a un motor especializado puede aportar:

- APIs listas para colisiones, animaciones y audio.
- Gestión de escenas y estados del juego.
- Mejor portabilidad a móviles y escritorio.
- Ecosistema de plugins y documentación más amplia.

### Deploy en GitHub Pages (opcional)
1) Crea un repo y sube los archivos.
2) Activa GitHub Pages en la rama `main`, carpeta root.
3) Accede a `https://<tu-usuario>.github.io/<tu-repo>/`.

### Licencia
MIT. Asegúrate de tener derechos para los sprites e imágenes que utilices.
