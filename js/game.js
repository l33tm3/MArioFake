(function() {
  'use strict';

  // --- Utilidades DOM seguras ------------------------------------------------
  function byId(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error("Elemento #" + id + " no existe en el DOM");
    return el;
  }

  function setText(el, value) {
    // Evitamos encadenar getElementById(...).textContent = ...
    // Siempre actuamos sobre una referencia estable del elemento.
    el.textContent = String(value);
  }

  function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

  document.addEventListener('DOMContentLoaded', () => {
    // --- Referencias de UI (una sola vez) -----------------------------------
    const UI = {
      coins: byId('coins'),
      score: byId('score'),
      flightText: byId('flightText'),
      flightBar: byId('flightBar'),
      healthText: byId('healthText'),
      healthBar: byId('healthBar'),
      canvas: byId('game'),
      mainMenu: byId('mainMenu'),
      startButton: byId('startButton'),
      controlsCanvas: byId('controls-canvas')
    };

    // --- Audio --------------------------------------------------------------
    const mainMusic = new Audio('audio/main.mp3');
    mainMusic.loop = true;

    const coinSound = new Audio('audio/coin-on.mp3');

    // --- Sprites ------------------------------------------------------------
    const coinImg = new Image();
    coinImg.src = 'sprites/coin.png';
    const blockImg = new Image();
    blockImg.src = 'sprites/bloque.png';

    // --- Estado del juego ----------------------------------------------------
    const ctx = UI.canvas.getContext('2d', { alpha: false });
    // Mejor para pixel art
    ctx.imageSmoothingEnabled = false;
    const W = UI.canvas.width, H = UI.canvas.height;
    // Ajustamos el suelo para que coincida con el nivel del camino en el paisaje
    // Los personajes deben estar en la acera/camino de la parte inferior
    const groundY = H - 45; // Ajustado para el nivel del camino
    const skyY = 12; // techo lógico para no salir por arriba

    // Factor de escala para todos los personajes y sprites
    // Permite ajustar fácilmente el tamaño sin modificar las imágenes originales
    const CHAR_SCALE = 3.0; // Aumentado para que los personajes sean más visibles


    const state = {
      running: false,
      gameStarted: false,
      frames: 0,
      keys: Object.create(null),
      cameraX: 0,
      currentLevel: 0,
      worldWidth: 3200,
      endX: 3000,
      bg: {
        image: null,
        loaded: false,
        speed: 0.35,
        scale: 1,
        tileW: 0,
        tileH: 0
      },
      // La heroína se llama Daniela Velozo
      player: {
        x: 120,
        y: groundY - Math.round(40 * CHAR_SCALE),
        w: Math.round(24 * CHAR_SCALE), // Reducido el ancho para mejor colisión
        h: Math.round(38 * CHAR_SCALE), // Reducido ligeramente la altura
        vx: 0, vy: 0,
        speed: 3.5,         // Velocidad ajustada para el nuevo tamaño
        onGround: true,
        facing: 1,
        coins: 0,
        score: 0,
        flight: 100,
        flightMax: 100,
        flightCooldown: 0,
        flyPower: 1.2,      // empuje vertical mejorado
        gravity: 0.8,       // gravedad ajustada
        maxAscendSpeed: 6.0,
        jump: 18.0,         // salto mejorado
        shootCooldown: 0,   // cooldown de disparo
        maxShootCooldown: 20, // frames entre disparos
        health: 100,        // salud actual
        maxHealth: 100,     // salud máxima
        invulnerable: 0,    // frames de invulnerabilidad
        lastDamageType: ''  // tipo del último daño recibido
      },
      sprite: {
        images: [],
        loaded: false,
        frameIndex: 0,
        animations: {
          // 0: estática (1.png), 1: caminando (2.png)
          idle: [0],
          walk: [0, 1]
        },
        speed: 4, // Animación más fluida para el tamaño grande
        current: 'idle'
      },
      coins: [], platforms: [], blocks: [], enemies: [], enemySprites: {}, powerups: [],
      projectiles: [],
      // Bebé Facundo que sigue a Daniela
      baby: {
        x: 80,
        y: groundY,
        w: Math.round(16 * CHAR_SCALE),
        h: Math.round(24 * CHAR_SCALE),
        vx: 0,
        vy: 0,
        onGround: false,
        flip: false,
        sprite: null,
        frameIndex: 0,
        frameCounter: 0,
        animSpeed: 10,
        followDistance: 100,
        speed: 2.2,
        jump: 10.0,
        gravity: 0.8,
        targetX: 80  // Posición objetivo para seguimiento suave
      }
    };

    const levels = [
      { // Nivel 1 - Extendido
        worldWidth: 8000, endX: 7800,
        coins: [
          // Sección inicial
          {x: 360, y: groundY - 180, r: 15}, {x: 520, y: groundY - 120, r: 15},
          {x: 780, y: groundY - 220, r: 15}, {x: 1200, y: groundY - 180, r: 15},
          {x: 1400, y: groundY - 220, r: 15}, {x: 1650, y: groundY - 160, r: 15},
          // Sección media
          {x: 2000, y: groundY - 200, r: 15}, {x: 2200, y: groundY - 150, r: 15},
          {x: 2400, y: groundY - 250, r: 15}, {x: 2700, y: groundY - 180, r: 15},
          {x: 3000, y: groundY - 220, r: 15}, {x: 3300, y: groundY - 160, r: 15},
          // Sección avanzada
          {x: 3600, y: groundY - 200, r: 15}, {x: 3900, y: groundY - 240, r: 15},
          {x: 4200, y: groundY - 180, r: 15}, {x: 4500, y: groundY - 220, r: 15},
          {x: 4800, y: groundY - 160, r: 15}, {x: 5100, y: groundY - 200, r: 15},
          // Sección final
          {x: 5500, y: groundY - 250, r: 15}, {x: 5800, y: groundY - 180, r: 15},
          {x: 6200, y: groundY - 220, r: 15}, {x: 6500, y: groundY - 160, r: 15},
          {x: 6800, y: groundY - 200, r: 15}, {x: 7200, y: groundY - 240, r: 15}
        ],
        platforms: [
          // Sección inicial
          {x: 300, y: groundY - 80, w: 200, h: 16}, {x: 700, y: groundY - 130, w: 150, h: 16},
          {x: 1100, y: groundY - 100, w: 220, h: 16}, {x: 1500, y: groundY - 150, w: 200, h: 16},
          {x: 1900, y: groundY - 120, w: 180, h: 16}, {x: 2300, y: groundY - 170, w: 250, h: 16},
          // Sección media
          {x: 2700, y: groundY - 90, w: 180, h: 16}, {x: 3100, y: groundY - 140, w: 200, h: 16},
          {x: 3500, y: groundY - 110, w: 160, h: 16}, {x: 3900, y: groundY - 160, w: 220, h: 16},
          // Sección avanzada
          {x: 4300, y: groundY - 130, w: 190, h: 16}, {x: 4700, y: groundY - 180, w: 170, h: 16},
          {x: 5100, y: groundY - 150, w: 200, h: 16}, {x: 5500, y: groundY - 200, w: 180, h: 16},
          // Sección final
          {x: 5900, y: groundY - 170, w: 160, h: 16}, {x: 6300, y: groundY - 120, w: 240, h: 16},
          {x: 6700, y: groundY - 150, w: 180, h: 16}, {x: 7100, y: groundY - 190, w: 200, h: 16}
        ],
        blocks: [
          // Sección inicial
          {x: 600, y: groundY - 200, w: 36, h: 36, type: 'question', state: 'full'},
          {x: 636, y: groundY - 200, w: 36, h: 36, type: 'brick', state: 'solid'},
          {x: 672, y: groundY - 200, w: 36, h: 36, type: 'brick', state: 'solid'},
          {x: 1200, y: groundY - 240, w: 36, h: 36, type: 'question', state: 'full'},
          {x: 1450, y: groundY - 280, w: 36, h: 36, type: 'brick', state: 'solid'},
          // Sección media
          {x: 2500, y: groundY - 220, w: 36, h: 36, type: 'question', state: 'full'},
          {x: 2900, y: groundY - 260, w: 36, h: 36, type: 'brick', state: 'solid'},
          {x: 3200, y: groundY - 200, w: 36, h: 36, type: 'question', state: 'full'},
          // Sección avanzada
          {x: 4000, y: groundY - 240, w: 36, h: 36, type: 'brick', state: 'solid'},
          {x: 4036, y: groundY - 240, w: 36, h: 36, type: 'question', state: 'full'},
          {x: 4072, y: groundY - 240, w: 36, h: 36, type: 'brick', state: 'solid'},
          {x: 4600, y: groundY - 280, w: 36, h: 36, type: 'question', state: 'full'},
          // Sección final
          {x: 5300, y: groundY - 250, w: 36, h: 36, type: 'brick', state: 'solid'},
          {x: 5700, y: groundY - 220, w: 36, h: 36, type: 'question', state: 'full'},
          {x: 6100, y: groundY - 260, w: 36, h: 36, type: 'brick', state: 'solid'},
          {x: 6900, y: groundY - 200, w: 36, h: 36, type: 'question', state: 'full'}
        ],
        enemies: [
          // Sección inicial
          {type: 'default', x: 900, y: groundY - 36, w: 36, h: 36, vx: -1.0, patrolLeft: 860, patrolRight: 1000},
          {type: 'facundo', x: 1700, y: groundY - 36, w: 36, h: 36, vx: -0.8, patrolLeft: 1660, patrolRight: 1780},
          // Sección media
          {type: 'martin', x: 2400, y: groundY - 36, w: 36, h: 36, vx: -1.2, patrolLeft: 2350, patrolRight: 2550},
          {type: 'default', x: 2800, y: groundY - 36, w: 36, h: 36, vx: 0.9, patrolLeft: 2750, patrolRight: 2950},
          {type: 'facundo', x: 3400, y: groundY - 36, w: 36, h: 36, vx: -0.7, patrolLeft: 3350, patrolRight: 3500},
          // Sección avanzada
          {type: 'martin', x: 4100, y: groundY - 36, w: 36, h: 36, vx: -1.3, patrolLeft: 4050, patrolRight: 4250},
          {type: 'default', x: 4500, y: groundY - 36, w: 36, h: 36, vx: 1.1, patrolLeft: 4450, patrolRight: 4650},
          {type: 'facundo', x: 5000, y: groundY - 36, w: 36, h: 36, vx: -0.8, patrolLeft: 4950, patrolRight: 5150},
          // Sección final
          {type: 'martin', x: 5600, y: groundY - 36, w: 36, h: 36, vx: -1.4, patrolLeft: 5550, patrolRight: 5750},
          {type: 'default', x: 6000, y: groundY - 36, w: 36, h: 36, vx: 1.0, patrolLeft: 5950, patrolRight: 6150},
          {type: 'facundo', x: 6400, y: groundY - 36, w: 36, h: 36, vx: -0.7, patrolLeft: 6350, patrolRight: 6550},
          {type: 'flaitaneke', x: 6800, y: groundY - 36, w: 36, h: 36, vx: -0.8, patrolLeft: 6700, patrolRight: 7000}, // Jefe de área
          {type: 'martin', x: 7300, y: groundY - 36, w: 36, h: 36, vx: -1.5, patrolLeft: 7250, patrolRight: 7500}
        ],
        powerups: [
          {type: 'health', x: 1500, y: groundY - 200, w: 30, h: 30, value: 30},
          {type: 'health', x: 3800, y: groundY - 200, w: 30, h: 30, value: 30},
          {type: 'health', x: 5500, y: groundY - 250, w: 30, h: 30, value: 50}
        ]
      },
      { // Nivel 2
        worldWidth: 4000, endX: 3800,
        coins: [
          {x: 400, y: groundY - 210, r: 15}, {x: 600, y: groundY - 260, r: 15},
          {x: 900, y: groundY - 160, r: 15}, {x: 1500, y: groundY - 310, r: 15},
          {x: 2000, y: groundY - 140, r: 15}, {x: 2500, y: groundY - 240, r: 15},
          {x: 3000, y: groundY - 280, r: 15}, {x: 3500, y: groundY - 180, r: 15}
        ],
        platforms: [
          {x: 200, y: groundY - 100, w: 130, h: 16}, {x: 550, y: groundY - 150, w: 190, h: 16},
          {x: 800, y: groundY - 200, w: 250, h: 16}, {x: 1200, y: groundY - 250, w: 150, h: 16},
          {x: 1800, y: groundY - 130, w: 300, h: 16}, {x: 2400, y: groundY - 210, w: 220, h: 16},
          {x: 2900, y: groundY - 260, w: 250, h: 16}, {x: 3400, y: groundY - 150, w: 190, h: 16}
        ],
        blocks: [
          {x: 600, y: groundY - 320, w: 36, h: 36, type: 'question', state: 'full'},
          {x: 1500, y: groundY - 370, w: 36, h: 36, type: 'question', state: 'full'},
          {x: 2200, y: groundY - 180, w: 36, h: 36, type: 'brick', state: 'solid'},
          {x: 2236, y: groundY - 180, w: 36, h: 36, type: 'brick', state: 'solid'}
        ],
        enemies: [
          {type: 'default', x: 500, y: groundY - 36, w: 36, h: 36, vx: -1.1, patrolLeft: 450, patrolRight: 650},
          {type: 'facundo', x: 1000, y: groundY - 36, w: 36, h: 36, vx: -0.7, patrolLeft: 950, patrolRight: 1150},
          {type: 'flaitaneke', x: 1400, y: groundY - 36, w: 36, h: 36, vx: -0.9, patrolLeft: 1300, patrolRight: 1500}, // Mini-jefe medio
          {type: 'default', x: 1800, y: groundY - 36, w: 36, h: 36, vx: 1.0, patrolLeft: 1750, patrolRight: 1950},
          {type: 'martin', x: 2600, y: groundY - 36, w: 36, h: 36, vx: -1.3, patrolLeft: 2500, patrolRight: 2800},
          {type: 'flaitaneke', x: 3200, y: groundY - 36, w: 36, h: 36, vx: -1.0, patrolLeft: 3100, patrolRight: 3400} // Jefe final nivel 2
        ],
        powerups: [
          {type: 'health', x: 800, y: groundY - 250, w: 30, h: 30, value: 40},
          {type: 'health', x: 2000, y: groundY - 200, w: 30, h: 30, value: 40}
        ]
      }
    ];

    // Cargar sprites del jugador (1.png estático, 2.png caminando)
    let playerImgsLoaded = 0;
    ['sprites/daniela/1.png', 'sprites/daniela/2.png'].forEach((src, idx) => {
      const img = new Image();
      img.onload = () => {
        playerImgsLoaded++;
        if (playerImgsLoaded === 2) {
          state.sprite.loaded = true;
        }
      };
      img.onerror = () => { console.warn(`No se pudo cargar '${src}'.`); };
      img.src = src;
      state.sprite.images[idx] = img;
    });

    // Cargar fondo (paisaje.png o paisaje.jpg)
    const bgImg = new Image();
    const tryJpgIfPngFails = () => {
      const tryJpg = new Image();
      tryJpg.onload = () => {
        state.bg.loaded = true;
        state.bg.image = tryJpg;
        state.bg.scale = UI.canvas.height / tryJpg.naturalHeight;
        state.bg.tileW = Math.ceil(tryJpg.naturalWidth * state.bg.scale);
        state.bg.tileH = Math.ceil(tryJpg.naturalHeight * state.bg.scale);
      };
      tryJpg.onerror = () => { console.warn("No se pudo cargar 'paisaje.png' ni 'paisaje.jpg'. Se usará color de fondo."); };
      tryJpg.src = 'pruebapsaiaje.jpg';
    };
    bgImg.onload = () => {
      state.bg.loaded = true;
      state.bg.image = bgImg;
      state.bg.scale = UI.canvas.height / bgImg.naturalHeight;
      state.bg.tileW = Math.ceil(bgImg.naturalWidth * state.bg.scale);
      state.bg.tileH = Math.ceil(bgImg.naturalHeight * state.bg.scale);
    };
    bgImg.onerror = tryJpgIfPngFails;
    bgImg.src = 'pruebapsaiaje.png';

    // Cargar sprites de enemigos
    const enemySpriteTypes = ['martin', 'facundo'];
    state.enemySprites = {};
    enemySpriteTypes.forEach(t => {
      const img1 = new Image();
      const img2 = new Image();
      
      img1.onload = () => console.log(`Sprite cargado: ${t}/1.png`);
      img1.onerror = () => console.warn(`Error cargando sprite: sprites/${t}/1.png`);
      img1.src = `sprites/${t}/1.png`;
      
      img2.onload = () => console.log(`Sprite cargado: ${t}/2.png`);
      img2.onerror = () => console.warn(`Error cargando sprite: sprites/${t}/2.png`);
      img2.src = `sprites/${t}/2.png`;
      
      state.enemySprites[t] = [img1, img2];
    });
    
    // Cargar sprites de Flaitaneke (enemigo elite)
    state.enemySprites.flaitaneke = {
      idle: [],
      combo: [],
      shoot: []
    };
    
    // Sprites de idle/caminar
    for (let i = 1; i <= 5; i++) {
      const img = new Image();
      img.onload = () => console.log(`Sprite elite cargado: enemyelite/${i}.png`);
      img.onerror = () => console.warn(`Error cargando sprite elite: sprites/enemyelite/${i}.png`);
      img.src = `sprites/enemyelite/${i}.png`;
      state.enemySprites.flaitaneke.idle.push(img);
    }
    
    // Sprites de combo
    for (let i = 1; i <= 2; i++) {
      const img = new Image();
      img.src = `sprites/enemyelite/action/combo/${i}.png`;
      state.enemySprites.flaitaneke.combo.push(img);
    }
    
    // Sprites de disparo
    for (let i = 1; i <= 3; i++) {
      const img = new Image();
      img.src = `sprites/enemyelite/action/arma/${i}.png`;
      state.enemySprites.flaitaneke.shoot.push(img);
    }
    
    // Estado para proyectiles
    state.projectiles = [];
    
    // Cargar sprites del bebé Facundo
    state.baby.sprite = [];
    const babyImg1 = new Image();
    const babyImg2 = new Image();
    babyImg1.src = 'sprites/facundo/1.png';
    babyImg2.src = 'sprites/facundo/2.png';
    state.baby.sprite = [babyImg1, babyImg2];

    // --- Input ----------------------------------------------------------------
    const kmap = {
      'ArrowLeft':'left','ArrowRight':'right',
      'a':'left','d':'right',
      ' ':'jump','Space':'jump','Spacebar':'jump','z':'jump','Z':'jump',
      'Shift':'run','x':'run','X':'run',
      'c':'shoot','C':'shoot','Control':'shoot', // Disparar con C o Control
      'r':'reset','R':'reset','p':'pause','P':'pause'
    };
    window.addEventListener('keydown', (e) => {
      const mappedKey = kmap[e.key];
      if (mappedKey) {
        state.keys[mappedKey] = true;
        // Evitar el scroll del navegador cuando se usa la tecla de salto
        if (mappedKey === 'jump') e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => { const k=kmap[e.key]; if(k){ state.keys[k]=false; }});

    // --- Touch Controls -------------------------------------------------------
    // Sistema de controles táctiles con Canvas
    const touchControls = {
      ctx: null,
      buttons: {
        left: { x: 50, y: 50, radius: 35, pressed: false, color: '#333333' },
        right: { x: 130, y: 50, radius: 35, pressed: false, color: '#333333' },
        jump: { x: 0, y: 50, radius: 40, pressed: false, color: '#2e7d32' },
        run: { x: 0, y: 50, radius: 35, pressed: false, color: '#e65100' },
        shoot: { x: 0, y: 50, radius: 35, pressed: false, color: '#1565c0' },
        reset: { x: 0, y: 0, radius: 25, pressed: false, color: '#c62828' },
        fullscreen: { x: 0, y: 0, radius: 25, pressed: false, color: '#6a1b9a' }
      },
      touches: new Map(),
      initialized: false
    };

    function initTouchControls() {
      if (!UI.controlsCanvas || touchControls.initialized) return;
      
      console.log('Inicializando canvas de controles...');
      const canvas = UI.controlsCanvas;
      if (!canvas) {
        console.error('Canvas de controles no encontrado!');
        return;
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('No se pudo obtener contexto 2D del canvas!');
        return;
      }
      
      touchControls.ctx = ctx;
      console.log('Canvas inicializado correctamente');
      
      // Configurar tamaño del canvas
      function resizeControlsCanvas() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width || window.innerWidth;
        canvas.height = rect.height || 150;
        
        console.log(`Canvas redimensionado: ${canvas.width}x${canvas.height}`);
        
        // Calcular tamaños responsivos
        const w = canvas.width;
        const h = canvas.height;
        const baseSize = Math.min(w * 0.1, h * 0.25); // Botones más grandes
        const spacing = baseSize * 1.8; // Menos espacio entre botones
        
        // Ajustar tamaños de botones responsivamente
        const leftButtonSize = baseSize * 0.9;
        const actionButtonSize = baseSize;
        const jumpButtonSize = baseSize * 1.1;
        const smallButtonSize = baseSize * 0.7;
        
        // Actualizar radios de botones
        touchControls.buttons.left.radius = leftButtonSize;
        touchControls.buttons.right.radius = leftButtonSize;
        touchControls.buttons.jump.radius = jumpButtonSize;
        touchControls.buttons.shoot.radius = actionButtonSize;
        touchControls.buttons.run.radius = actionButtonSize;
        touchControls.buttons.reset.radius = smallButtonSize;
        touchControls.buttons.fullscreen.radius = smallButtonSize;
        
        // D-pad a la izquierda - más cerca del borde
        const dpadX = leftButtonSize * 1.8;
        const dpadY = h - leftButtonSize * 1.5;
        touchControls.buttons.left.x = dpadX - leftButtonSize * 1.1;
        touchControls.buttons.left.y = dpadY;
        touchControls.buttons.right.x = dpadX + leftButtonSize * 1.1;
        touchControls.buttons.right.y = dpadY;
        
        // Botones de acción a la derecha - mejor distribuidos
        const actionBaseX = w - baseSize * 1.5;
        const actionBaseY = h - baseSize * 1.5;
        
        // Saltar arriba
        touchControls.buttons.jump.x = actionBaseX - spacing * 0.7;
        touchControls.buttons.jump.y = actionBaseY - baseSize * 0.8;
        
        // Disparar izquierda
        touchControls.buttons.shoot.x = actionBaseX - spacing * 1.4;
        touchControls.buttons.shoot.y = actionBaseY;
        
        // Correr derecha
        touchControls.buttons.run.x = actionBaseX;
        touchControls.buttons.run.y = actionBaseY;
        
        // Botones superiores
        touchControls.buttons.reset.x = w - smallButtonSize * 2;
        touchControls.buttons.reset.y = smallButtonSize * 2;
        
        touchControls.buttons.fullscreen.x = w - smallButtonSize * 5;
        touchControls.buttons.fullscreen.y = smallButtonSize * 2;
        
        drawTouchControls();
      }
      
      window.addEventListener('resize', resizeControlsCanvas);
      window.addEventListener('orientationchange', resizeControlsCanvas);
      
      // Detectar cambios de pantalla completa
      document.addEventListener('fullscreenchange', () => {
        setTimeout(resizeControlsCanvas, 100);
      });
      
      resizeControlsCanvas();
      
      // Manejar eventos táctiles
      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
      canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
      canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
      
      touchControls.initialized = true;
      
      // Dibujar controles inmediatamente
      drawTouchControls();
      
      // No actualizar constantemente para mejorar rendimiento
      // Solo dibujar cuando hay cambios
      
      console.log('Controles táctiles completamente inicializados');
    }

    function handleTouchStart(e) {
      e.preventDefault();
      const rect = UI.controlsCanvas.getBoundingClientRect();
      
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        // Verificar qué botón fue presionado
        for (const [key, button] of Object.entries(touchControls.buttons)) {
          const dist = Math.hypot(x - button.x, y - button.y);
          if (dist < button.radius) {
            button.pressed = true;
            
            // Manejar botones especiales
            if (key === 'fullscreen') {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
              } else {
                document.exitFullscreen();
              }
            } else {
              state.keys[key] = true;
            }
            
            touchControls.touches.set(touch.identifier, key);
            drawTouchControls(); // Actualizar visual
            break;
          }
        }
      }
      drawTouchControls();
    }

    function handleTouchMove(e) {
      e.preventDefault();
      const rect = UI.controlsCanvas.getBoundingClientRect();
      
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        const previousKey = touchControls.touches.get(touch.identifier);
        
        // Verificar si el toque se movió a otro botón
        let newKey = null;
        for (const [key, button] of Object.entries(touchControls.buttons)) {
          const dist = Math.hypot(x - button.x, y - button.y);
          if (dist < button.radius) {
            newKey = key;
            break;
          }
        }
        
        // Actualizar estados si cambió el botón
        if (previousKey !== newKey) {
          if (previousKey) {
            touchControls.buttons[previousKey].pressed = false;
            state.keys[previousKey] = false;
          }
          if (newKey) {
            touchControls.buttons[newKey].pressed = true;
            state.keys[newKey] = true;
          }
          touchControls.touches.set(touch.identifier, newKey);
        }
      }
      drawTouchControls();
    }

    function handleTouchEnd(e) {
      e.preventDefault();
      
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const key = touchControls.touches.get(touch.identifier);
        
        if (key && touchControls.buttons[key]) {
          touchControls.buttons[key].pressed = false;
          state.keys[key] = false;
        }
        
        touchControls.touches.delete(touch.identifier);
      }
      drawTouchControls();
    }

    function drawTouchControls() {
      if (!touchControls.ctx) return;
      
      const ctx = touchControls.ctx;
      const canvas = UI.controlsCanvas;
      
      // Limpiar canvas (completamente transparente)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Dibujar cada botón
      for (const [key, button] of Object.entries(touchControls.buttons)) {
        ctx.save();
        
        // Sombra
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 5;
        
        // Círculo del botón
        ctx.beginPath();
        ctx.arc(button.x, button.y, button.radius, 0, Math.PI * 2);
        
        // Color ultra transparente
        if (button.pressed) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.globalAlpha = 1;
        }
        
        ctx.fill();
        
        // Borde sutil
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Texto/Símbolo con mayor contraste
        const fontSize = button.radius * 0.8;
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Sombra para mejor legibilidad
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        
        ctx.fillStyle = button.pressed ? '#ffffff' : 'rgba(255, 255, 255, 0.9)';
        ctx.globalAlpha = 1;
        
        switch(key) {
          case 'left': ctx.fillText('◀', button.x, button.y); break;
          case 'right': ctx.fillText('▶', button.x, button.y); break;
          case 'jump': ctx.fillText('↑', button.x, button.y); break;
          case 'run': ctx.fillText('R', button.x, button.y); break;
          case 'shoot': ctx.fillText('⚡', button.x, button.y); break;
          case 'reset': 
            ctx.fillText('↻', button.x, button.y); 
            break;
          case 'fullscreen':
            ctx.fillText('⛶', button.x, button.y);
            break;
        }
        
        ctx.restore();
      }
      
      // Sin etiquetas de texto para mantener interfaz limpia
    }

    // Inicializar controles táctiles en dispositivos móviles y tablets
    function shouldShowTouchControls() {
      return ('ontouchstart' in window) || 
             (window.matchMedia('(hover: none)').matches) ||
             (window.matchMedia('(pointer: coarse)').matches) ||
             (window.innerWidth <= 1366);
    }
    
    if (shouldShowTouchControls()) {
      console.log('Inicializando controles táctiles...');
      setTimeout(() => {
        initTouchControls();
        // Asegurar que el canvas sea visible
        const mobileControls = document.querySelector('.mobile-controls');
        if (mobileControls) {
          mobileControls.classList.add('show');
          console.log('Clase show añadida a controles móviles');
        }
      }, 100);
    }

    // Función para iniciar el juego
    function startGame() {
      UI.mainMenu.classList.add('hidden');
      loadLevel(0);
      state.running = true;
      state.gameStarted = true;
      mainMusic.play();
      
      // Inicializar controles táctiles si es necesario
      if (shouldShowTouchControls() && !touchControls.initialized) {
        initTouchControls();
        // Forzar visibilidad
        const mobileControls = document.querySelector('.mobile-controls');
        if (mobileControls) {
          mobileControls.classList.add('show');
          console.log('Controles móviles activados con clase show');
        }
      }
    }
    
    // Prevenir zoom al hacer doble tap
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }, { passive: false });
    
    // Añadir eventos para click y touch
    UI.startButton.addEventListener('click', startGame);
    
    // Manejar touch con prevención de eventos duplicados
    let touchStarted = false;
    UI.startButton.addEventListener('touchstart', (e) => {
      e.preventDefault();
      touchStarted = true;
      UI.startButton.style.background = '#388e3c';
    }, { passive: false });
    
    UI.startButton.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (touchStarted) {
        touchStarted = false;
        UI.startButton.style.background = '#4caf50';
        startGame();
      }
    }, { passive: false });
    
    UI.startButton.addEventListener('touchcancel', (e) => {
      touchStarted = false;
      UI.startButton.style.background = '#4caf50';
    });

    // --- Helpers de juego ------------------------------------------------------
    function loadLevel(levelIndex) {
      if (levelIndex >= levels.length) {
          // Has ganado el juego
          state.running = false;
          UI.mainMenu.querySelector('h1').textContent = '¡Has Ganado!';
          UI.mainMenu.querySelector('p').textContent = `Puntaje Final: ${state.player.score}`;
          UI.mainMenu.querySelector('button').style.display = 'none'; // Ocultar botón
          UI.mainMenu.classList.remove('hidden');
          return;
      }

      const level = levels[levelIndex];
      state.currentLevel = levelIndex;
      state.worldWidth = level.worldWidth;
      state.endX = level.endX;

      // Deep copy para evitar modificar la plantilla del nivel
      state.coins = JSON.parse(JSON.stringify(level.coins));
      state.platforms = JSON.parse(JSON.stringify(level.platforms));
      state.blocks = JSON.parse(JSON.stringify(level.blocks));
      
      // Filtrar enemigos: excluir a Facundo ya que ahora es el bebé
      state.enemies = JSON.parse(JSON.stringify(level.enemies)).filter(e => e.type !== 'facundo');
      state.powerups = JSON.parse(JSON.stringify(level.powerups || []));

      // Guardar estado inicial para reseteos
      state.blocks.forEach(b => b.initState = b.state);
      state.enemies.forEach(e => {
          let typeScale = 1;
          switch (e.type) {
            case 'martin':
              typeScale = 0.7; // Martin es un niño, más pequeño que Daniela
              break;
            case 'facundo':
              typeScale = 0.4; // Facundo es un bebé, muy pequeño
              break;
            case 'flaitaneke':
              typeScale = 1.0; // Flaitaneke es elite, tamaño similar a Daniela
              break;
            case 'default':
              typeScale = 0.6; // Enemigos default tamaño intermedio
              break;
          }
          const finalScale = CHAR_SCALE * typeScale;
          e.w = Math.round(e.w * finalScale);
          e.h = Math.round(e.h * finalScale);
          e.y = groundY - e.h;
          e.sx = e.x;
          e.sy = e.y;
          e.svx = e.vx;
          e.alive = true;
          e.frameIndex = 0;
          e.frameCounter = 0;
          e.animSpeed = 12; // Animación más rápida para el tamaño grande
          
          // Sistema de salud para todos los enemigos
          switch (e.type) {
            case 'flaitaneke':
              e.state = 'idle'; // idle, combo, shoot
              e.actionCooldown = 0;
              e.comboCooldown = 0;
              e.shootCooldown = 0;
              e.health = 150; // Mucha salud
              e.maxHealth = 150;
              e.animSpeed = 8; // Animación más fluida
              e.detectionRange = 300; // Rango de detección del jugador
              e.attackRange = 150; // Rango para atacar
              e.damage = 25; // Daño alto
              break;
            case 'martin':
              e.health = 40; // Salud media
              e.maxHealth = 40;
              e.damage = 15; // Daño medio
              break;
            case 'facundo':
              e.health = 20; // Poca salud (es un bebé)
              e.maxHealth = 20;
              e.damage = 10; // Daño bajo
              break;
            default:
              e.health = 30; // Salud estándar
              e.maxHealth = 30;
              e.damage = 12; // Daño estándar
              break;
          }
      });

      // Resetear bebé Facundo
      state.baby.x = 80;
      state.baby.y = groundY;
      state.baby.vx = 0;
      state.baby.vy = 0;
      state.baby.onGround = false;
      state.baby.flip = false;
      state.baby.frameIndex = 0;
      state.baby.frameCounter = 0;
      
      resetPlayer();
      state.cameraX = 0;
      state.projectiles = []; // Limpiar proyectiles al cargar nivel
      updateFlightUI();
    }

    function resetPlayer() {
        const p = state.player;
        p.x = 120; p.y = groundY - p.h; p.vx = 0; p.vy = 0; p.onGround = true;
        p.flight = p.flightMax;
        p.flightCooldown = 0;
        p.health = p.maxHealth;
        p.invulnerable = 0;
        updateHealthUI();
        // El puntaje y monedas se mantienen entre niveles, no se resetean aquí
      }

    function addCoins(n){
      state.player.coins += n;
      state.player.score += 100*n;
      setText(UI.coins, state.player.coins);
      setText(UI.score, state.player.score);
      coinSound.currentTime = 0;
      coinSound.play();
    }

    function clampFlight(){
      const p = state.player;
      p.flight = clamp(p.flight, 0, p.flightMax);
    }

    function resetGame(){
      // Asegurar que el juego esté en marcha
      state.running = true;
      state.gameStarted = true;
      
      // Restablece el nivel actual
      loadLevel(state.currentLevel);
      // Restablece puntaje y monedas
      state.player.coins = 0;
      state.player.score = 0;
      setText(UI.coins, state.player.coins);
      setText(UI.score, state.player.score);
      
      // Limpiar cualquier estado congelado
      state.keys = Object.create(null);
      console.log('Juego reiniciado correctamente');
    }

    function updateFlightUI(){
      const p = state.player;
      clampFlight();
      const pct = Math.round((p.flight / p.flightMax) * 100);
      setText(UI.flightText, pct + '%');
      UI.flightBar.style.width = pct + '%';
    }
    
    function updateHealthUI(){
      const p = state.player;
      const pct = Math.round((p.health / p.maxHealth) * 100);
      setText(UI.healthText, pct + '%');
      UI.healthBar.style.width = pct + '%';
      
      // Cambiar color según salud
      if (pct > 60) {
        UI.healthBar.style.background = '#4caf50'; // Verde
      } else if (pct > 30) {
        UI.healthBar.style.background = '#ff9800'; // Naranja
      } else {
        UI.healthBar.style.background = '#ff4444'; // Rojo
      }
    }
    
    function takeDamage(amount, source){
      const p = state.player;
      if (p.invulnerable > 0 || p.health <= 0) return;
      
      p.health -= amount;
      p.lastDamageType = source;
      p.invulnerable = 120; // 2 segundos de invulnerabilidad
      
      if (p.health <= 0) {
        p.health = 0;
        console.log(`¡Daniela fue derrotada por ${source}!`);
        updateHealthUI();
        
        // Pequeño delay antes de reiniciar para evitar congelamiento
        setTimeout(() => {
          // Asegurar que el juego no esté pausado
          state.running = true;
          state.gameStarted = true;
          resetGame();
        }, 100);
      } else {
        console.log(`Daniela recibió ${amount} de daño de ${source}. Salud: ${p.health}/${p.maxHealth}`);
        updateHealthUI();
      }
    }

    function rectsOverlap(ax,ay,aw,ah, bx,by,bw,bh){
      return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
    }
    
    // Actualizar bebé Facundo (sigue a Daniela)
    function updateBaby() {
      const p = state.player;
      const b = state.baby;
      
      // Calcular distancia a Daniela
      const dx = p.x - b.x;
      const distance = Math.abs(dx);
      
      // Actualizar posición objetivo con suavizado
      if (p.facing === 1) {
        b.targetX = p.x - b.followDistance; // Seguir por detrás cuando mira a la derecha
      } else {
        b.targetX = p.x + p.w + b.followDistance - b.w; // Seguir por detrás cuando mira a la izquierda
      }
      
      // Movimiento suave hacia la posición objetivo
      const targetDx = b.targetX - b.x;
      const targetDistance = Math.abs(targetDx);
      
      if (targetDistance > 10) {
        // Acelerar gradualmente hacia el objetivo
        b.vx += targetDx * 0.02;
        b.vx = Math.max(-b.speed, Math.min(b.speed, b.vx)); // Limitar velocidad
        
        // Actualizar dirección del sprite
        if (b.vx > 0.1) {
          b.flip = false;
        } else if (b.vx < -0.1) {
          b.flip = true;
        }
      } else {
        // Desacelerar cuando está cerca
        b.vx *= 0.8;
      }
      
      // Aplicar física
      b.x += b.vx;
      b.vy += b.gravity;
      b.y += b.vy;
      
      // Colisión con el suelo
      if (b.y + b.h >= groundY) {
        b.y = groundY - b.h;
        b.vy = 0;
        b.onGround = true;
        
        // Saltar si Daniela está arriba o aleatoriamente por diversión
        if (b.onGround) {
          if (p.y < b.y - 50 && Math.random() < 0.1) {
            // Saltar para alcanzar a Daniela
            b.vy = -b.jump * 1.2;
            b.onGround = false;
          } else if (Math.abs(b.vx) > 1 && Math.random() < 0.02) {
            // Salto juguetón mientras camina
            b.vy = -b.jump * 0.8;
            b.onGround = false;
          }
        }
      }
      
      // Colisión con plataformas
      for (const plat of state.platforms) {
        if (b.vy > 0 && rectsOverlap(b.x, b.y, b.w, b.h, plat.x, plat.y, plat.w, plat.h)) {
          if (b.y < plat.y) {
            b.y = plat.y - b.h;
            b.vy = 0;
            b.onGround = true;
          }
        }
      }
      
      // Animación
      if (Math.abs(b.vx) > 0.1) {
        b.frameCounter++;
        if (b.frameCounter >= b.animSpeed) {
          b.frameCounter = 0;
          b.frameIndex = (b.frameIndex + 1) % 2;
        }
      } else {
        b.frameIndex = 0;
      }
      
      // Límites del mundo
      b.x = Math.max(0, Math.min(b.x, state.worldWidth - b.w));
      
      // Si Daniela está volando muy alto, el bebé espera mirándola
      if (p.y < b.y - 200 && b.onGround) {
        b.vx *= 0.5; // Reducir velocidad
        b.frameIndex = 0; // Pose estática
        // Mirar en dirección de Daniela
        b.flip = (p.x < b.x);
      }
    }

    // --- Loop -----------------------------------------------------------------
    // Variables para optimización de rendimiento
    const isMobile = shouldShowTouchControls();
    let lastFrameTime = 0;
    const targetFPS = isMobile ? 30 : 60;
    const frameTime = 1000 / targetFPS;
    
    function step(timestamp){
      // Limitar FPS en móviles
      if (isMobile && timestamp) {
        const deltaTime = timestamp - lastFrameTime;
        if (deltaTime < frameTime) {
          requestAnimationFrame(step);
          return;
        }
        lastFrameTime = timestamp;
      }
      
      if (!state.running) { requestAnimationFrame(step); return; }
      state.frames++;

      const p = state.player;
      const run = state.keys.run ? 1.5 : 1.0;
      p.vx = 0;
      if (state.keys.left)  p.vx = -p.speed * run;
      if (state.keys.right) p.vx =  p.speed * run;
      if (state.keys.left && !state.keys.right) p.facing = -1;
      else if (state.keys.right && !state.keys.left) p.facing = 1;

      // Reducir invulnerabilidad
      if (p.invulnerable > 0) p.invulnerable--;

      // Saltar - Mejorado con mejor respuesta
        if (state.keys.jump && p.onGround){
        p.vy = -p.jump;
        p.onGround = false;
      }
      
      // Disparar
      if (p.shootCooldown > 0) p.shootCooldown--;
      if (state.keys.shoot && p.shootCooldown === 0) {
        const projectile = {
          x: p.x + (p.facing > 0 ? p.w : 0),
          y: p.y + p.h/2,
          w: 15,
          h: 8,
          vx: p.facing * 12,
          vy: 0,
          type: 'player_shot',
          from: 'player'
        };
        state.projectiles.push(projectile);
        p.shootCooldown = p.maxShootCooldown;
        console.log('Daniela disparó!');
      }

      // Gravedad + vuelo
        if (!p.onGround){
          // Volar (planear/aletear) si queda energía y no está en cooldown
          if (state.keys.jump && p.flight > 0 && p.flightCooldown === 0){
            p.vy -= p.flyPower;    // empuje hacia arriba
            p.flight -= 0.8;       // gasta energía un poco más
            if (p.flight <= 0){
              p.flight = 0;
              p.flightCooldown = 60; // Cooldown reducido para mejor respuesta
            }
          }
          p.vy += p.gravity;       // gravedad
          // Limitar velocidad vertical ascendente
          if (p.vy < -p.maxAscendSpeed) p.vy = -p.maxAscendSpeed;
        }

        // Movimiento
        const oldX = p.x;
        const oldY = p.y;
        p.x += p.vx;
        p.y += p.vy;

      // Límites del mundo
      p.x = clamp(p.x, 0, state.worldWidth - p.w);

      // Colisiones con suelo y techo
      if (p.y + p.h >= groundY){
        p.y = groundY - p.h;
        p.vy = 0;
        if (!p.onGround){
          p.onGround = true;
        }
      } else {
        p.onGround = false;
      }
      if (p.y < skyY){
        p.y = skyY;
        if (p.vy < 0) p.vy = 0;
      }

      // Recarga de vuelo - Mejorada
      if (p.onGround || (p.vy === 0 && !state.keys.jump)){
        // Recargar en el suelo o cuando está parado en plataforma
          if (p.flightCooldown > 0){
            p.flightCooldown--;
          } else {
          p.flight += 2.5; // Recarga más rápida
            clampFlight();
          }
      } else if (!state.keys.jump && p.flight < p.flightMax) {
        // Recarga lenta en el aire cuando no está volando
        p.flight += 0.3;
        clampFlight();
        }
        updateFlightUI();

      // Colisiones con plataformas y bloques - Sistema mejorado
      const solids = state.platforms.concat(state.blocks.filter(b => b.state === 'solid' || b.type === 'question'));
      for (const s of solids){
        if (rectsOverlap(p.x, p.y, p.w, p.h, s.x, s.y, s.w, s.h)){
          // Calcular overlap en ambas direcciones
          const overlapX = Math.min(p.x + p.w - s.x, s.x + s.w - p.x);
          const overlapY = Math.min(p.y + p.h - s.y, s.y + s.h - p.y);
          
          // Resolver colisión por la dirección de menor overlap
          if (overlapX < overlapY) {
            // Colisión horizontal
            if (oldX + p.w <= s.x + 2) {
              // Venía desde la izquierda
            p.x = s.x - p.w;
              p.vx = 0;
            } else if (oldX >= s.x + s.w - 2) {
              // Venía desde la derecha
            p.x = s.x + s.w;
              p.vx = 0;
            }
          } else {
            // Colisión vertical
            if (oldY + p.h <= s.y + 8 && p.vy >= 0) {
              // Aterrizó encima (desde arriba) - ajuste más preciso
              p.y = s.y - p.h; // Sin offset adicional
            p.vy = 0;
            p.onGround = true;
            } else if (oldY >= s.y + s.h - 5 && p.vy <= 0) {
              // Golpeó desde abajo
            p.y = s.y + s.h;
            p.vy = 0;
              // Activar bloques de pregunta al golpearlos desde abajo
            if (s.type === 'question' && s.state !== 'empty'){
              addCoins(1);
              s.state = 'empty';
              }
            }
          }
        }
      }

      // IA básica de enemigos (patrulla horizontal)
      for (const e of state.enemies){
        if (!e.alive) continue;
        
        // IA especial para Flaitaneke
        if (e.type === 'flaitaneke') {
          const distanceToPlayer = Math.abs(p.x + p.w/2 - (e.x + e.w/2));
          const playerInRange = distanceToPlayer < e.detectionRange;
          const playerInAttackRange = distanceToPlayer < e.attackRange;
          
          // Reducir cooldowns
          if (e.actionCooldown > 0) e.actionCooldown--;
          if (e.comboCooldown > 0) e.comboCooldown--;
          if (e.shootCooldown > 0) e.shootCooldown--;
          
          // Cambiar estado según situación
          if (e.state === 'idle') {
            if (playerInRange && !playerInAttackRange) {
              // Perseguir al jugador
              const playerDir = p.x > e.x ? 1 : -1;
              e.vx = playerDir * 1.5;
              
              // Disparar si está a media distancia
              if (distanceToPlayer > 200 && distanceToPlayer < 400 && e.shootCooldown === 0) {
                e.state = 'shoot';
                e.actionCooldown = 30;
                e.shootCooldown = 120;
                e.frameIndex = 0;
                e.vx = 0;
              }
            } else if (playerInAttackRange && e.comboCooldown === 0) {
              // Hacer combo si está cerca
              e.state = 'combo';
              e.actionCooldown = 40;
              e.comboCooldown = 150;
              e.frameIndex = 0;
              e.vx = 0;
            } else {
              // Patrulla normal
              e.x += e.vx;
              if (e.x < e.patrolLeft){ e.x = e.patrolLeft; e.vx *= -1; }
              if (e.x + e.w > e.patrolRight){ e.x = e.patrolRight - e.w; e.vx *= -1; }
            }
          } else if (e.state === 'shoot') {
            if (e.actionCooldown === 25) {
              // Crear proyectil hacia el jugador
              const playerDir = p.x > e.x ? 1 : -1;
              const projectile = {
                x: e.x + (playerDir > 0 ? e.w : 0),
                y: e.y + e.h/2,
                w: 20,
                h: 10,
                vx: playerDir * 8,
                type: 'bullet',
                from: 'enemy'
              };
              state.projectiles.push(projectile);
              console.log(`Flaitaneke disparó hacia ${playerDir > 0 ? 'derecha' : 'izquierda'}`);
            }
            if (e.actionCooldown === 0) {
              e.state = 'idle';
            }
          } else if (e.state === 'combo') {
            // Moverse ligeramente hacia el jugador durante el combo
            if (e.actionCooldown > 20) {
              const comboDir = p.x > e.x ? 1 : -1;
              e.x += comboDir * 3;
            }
            if (e.actionCooldown === 0) {
              e.state = 'idle';
            }
          }
          
          // Animación según estado
          e.frameCounter++;
          if (e.frameCounter >= e.animSpeed){
            e.frameCounter = 0;
            if (e.state === 'idle') {
              e.frameIndex = (e.frameIndex + 1) % state.enemySprites.flaitaneke.idle.length;
            } else if (e.state === 'combo') {
              e.frameIndex = Math.min(e.frameIndex + 1, state.enemySprites.flaitaneke.combo.length - 1);
            } else if (e.state === 'shoot') {
              e.frameIndex = Math.min(e.frameIndex + 1, state.enemySprites.flaitaneke.shoot.length - 1);
            }
          }
        } else {
          // IA normal para otros enemigos
        e.x += e.vx;
        if (e.x < e.patrolLeft){ e.x = e.patrolLeft; e.vx *= -1; }
        if (e.x + e.w > e.patrolRight){ e.x = e.patrolRight - e.w; e.vx *= -1; }
        e.frameCounter++;
        if (e.frameCounter >= e.animSpeed){
          e.frameCounter = 0;
          e.frameIndex = (e.frameIndex + 1) % 2;
        }
        }
        // Colisión con jugador - Sistema mejorado
        if (rectsOverlap(p.x, p.y, p.w, p.h, e.x, e.y, e.w, e.h)){
          // Verificar si el jugador está saltando sobre el enemigo
          const stompFromAbove = p.vy > 0 && (p.y + p.h - Math.abs(p.vy) - 4) <= e.y;
          const playerCenterX = p.x + p.w / 2;
          const enemyCenterX = e.x + e.w / 2;
          const horizontalOverlap = Math.abs(playerCenterX - enemyCenterX) < (p.w + e.w) / 2 - 8;
          
          if (stompFromAbove && horizontalOverlap){
            // Jugador saltó sobre el enemigo - causa daño
            const stompDamage = 30; // Daño aumentado por stomp
            e.health -= stompDamage;
            p.vy = -8; // rebote
            state.player.score += 50;
            setText(UI.score, state.player.score);
            console.log(`Stomp en ${e.type}! Daño: ${stompDamage}, Salud: ${e.health}/${e.maxHealth}`);
            
            if (e.health <= 0) {
            e.alive = false;
              let bonus = 100;
              switch(e.type) {
                case 'flaitaneke': bonus = 500; break;
                case 'martin': bonus = 200; break;
                case 'facundo': bonus = 150; break;
              }
              state.player.score += bonus;
            setText(UI.score, state.player.score);
              console.log(`¡${e.type} derrotado! Bonus: ${bonus}`);
            }
          } else {
            // Colisión lateral - daño al jugador
            let damageAmount = e.damage || 10;
            if (e.type === 'flaitaneke' && e.state === 'combo') {
              damageAmount *= 1.5; // Combo hace más daño
            }
            takeDamage(damageAmount, e.type);
          }
        }
      }

      // Actualizar proyectiles
      for (let i = state.projectiles.length - 1; i >= 0; i--) {
        const proj = state.projectiles[i];
        proj.x += proj.vx;
        if (proj.vy) proj.y += proj.vy;
        
        // Eliminar proyectiles fuera de pantalla
        if (proj.x < -100 || proj.x > state.worldWidth + 100 || proj.y < -100 || proj.y > H + 100) {
          state.projectiles.splice(i, 1);
          continue;
        }
        
        // Colisión con jugador
        if (proj.from === 'enemy' && rectsOverlap(p.x, p.y, p.w, p.h, proj.x, proj.y, proj.w, proj.h)) {
          takeDamage(20, `proyectil de ${proj.type}`);
          state.projectiles.splice(i, 1);
          continue;
        }
        
        // Colisión con enemigos (proyectiles del jugador)
        if (proj.from === 'player') {
          for (const e of state.enemies) {
            if (!e.alive) continue;
            if (rectsOverlap(e.x, e.y, e.w, e.h, proj.x, proj.y, proj.w, proj.h)) {
              const shotDamage = 20; // Daño base de disparo aumentado
              e.health -= shotDamage;
              state.player.score += 25;
              console.log(`${e.type} golpeado! Daño: ${shotDamage}, Salud: ${e.health}/${e.maxHealth}`);
              
              if (e.health <= 0) {
                e.alive = false;
                let bonus = 100;
                switch(e.type) {
                  case 'flaitaneke': bonus = 500; break;
                  case 'martin': bonus = 200; break;
                  case 'facundo': bonus = 150; break;
                }
                state.player.score += bonus;
                console.log(`¡${e.type} derrotado con disparo! Bonus: ${bonus}`);
              }
              
              setText(UI.score, state.player.score);
              state.projectiles.splice(i, 1);
              break;
            }
          }
        }
      }

      // Actualizar cámara (scroll lateral)
      state.cameraX = clamp(p.x - W * 0.4, 0, Math.max(0, state.worldWidth - W));

      // Fin de nivel
      if (p.x >= state.endX){
        loadLevel(state.currentLevel + 1);
      }

      // Animación de sprite (caminar/idle)
      const spr = state.sprite;
      if (spr.loaded){
        const movingOnGround = p.onGround && Math.abs(p.vx) > 0.01;
        spr.current = movingOnGround ? 'walk' : 'idle';
        const seq = spr.animations[spr.current] || [0];
        const idx = Math.floor(state.frames / spr.speed) % seq.length;
        spr.frameIndex = seq[idx];
      }

      // Recoger monedas - Optimizado con culling
      for (const c of state.coins){
        if (!c.taken){
          // Solo verificar monedas cercanas al jugador
          const distanceToPlayer = Math.abs(c.x - (p.x + p.w/2));
          if (distanceToPlayer < 100) { // Solo verificar si está cerca
          const dx = (p.x + p.w/2) - c.x;
          const dy = (p.y + p.h/2) - c.y;
            const collisionRadius = c.r + Math.max(p.w,p.h)/2 * 0.7;
            if (Math.hypot(dx,dy) < collisionRadius){
            c.taken = true;
            addCoins(1);
            }
          }
        }
      }
      
      // Recoger powerups
      for (let i = state.powerups.length - 1; i >= 0; i--) {
        const pw = state.powerups[i];
        if (rectsOverlap(p.x, p.y, p.w, p.h, pw.x, pw.y, pw.w, pw.h)) {
          if (pw.type === 'health') {
            p.health = Math.min(p.health + pw.value, p.maxHealth);
            console.log(`¡Salud recuperada! +${pw.value} HP`);
            updateHealthUI();
          }
          state.powerups.splice(i, 1);
        }
      }

      // Actualizar bebé Facundo
      updateBaby();
      
      // Reinicio / pausa (conmutar)
      if (state.keys.reset){ resetGame(); state.keys.reset=false; }
      if (state.keys.pause){
        if (state.gameStarted) {
          state.running = !state.running;
        }
        state.keys.pause=false;
      }

      // Render
      draw();
      requestAnimationFrame(step);
    }

    function draw(){
      if (!state.gameStarted) {
          ctx.fillStyle = '#121212';
          ctx.fillRect(0, 0, W, H);
          return;
      }
      const camX = state.cameraX || 0;
      
      // Optimización de renderizado para móviles
      if (isMobile) {
        ctx.imageSmoothingEnabled = false; // Desactivar antialiasing en móviles
      }
      
      // Limpiar canvas
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(0, 0, W, H);
      
      // Fondo (parallax con mosaico)
      if (state.bg.loaded && state.bg.image){
        const s = state.bg;
        const tileW = s.tileW || W;
        const bOff = -Math.floor((state.cameraX * s.speed) % tileW);
        // Pintar suficiente para cubrir el ancho del canvas
        for (let x = bOff - tileW; x < W + tileW; x += tileW){
          ctx.drawImage(s.image, 0, 0, s.image.naturalWidth, s.image.naturalHeight, x, 0, tileW, H);
        }
      } else {
        // Fallback sólido si no hay imagen
        ctx.fillStyle = '#1a2030';
        ctx.fillRect(0,0,W,H);
      }

      // Sin dibujo de suelo sólido: se ve el paisaje completo

      // Plataformas
      ctx.fillStyle = '#49617a';
      for (const plat of state.platforms){
        const vx = Math.round(plat.x - camX);
        if (vx + plat.w < 0 || vx > W) continue;
        ctx.fillRect(vx, plat.y, plat.w, plat.h);
      }

      // Bloques
      for (const b of state.blocks){
        const vx = Math.round(b.x - camX);
        if (vx + b.w < 0 || vx > W) continue;
        if (blockImg.complete){
          ctx.drawImage(blockImg, vx, b.y, b.w, b.h);
          if (b.type === 'question' && b.state === 'empty'){
            ctx.fillStyle = '#5c5c5c';
            ctx.fillRect(vx, b.y, b.w, b.h);
          }
        } else {
          if (b.type === 'question'){
            ctx.fillStyle = (b.state === 'empty') ? '#5c5c5c' : '#d4a133';
          } else {
            ctx.fillStyle = '#8d6e63';
          }
          ctx.fillRect(vx, b.y, b.w, b.h);
        }
      }

      // Monedas - renderizar menos en móviles
      const coinStep = isMobile ? 2 : 1; // Saltar monedas en móviles
      for (let i = 0; i < state.coins.length; i += coinStep){
        const c = state.coins[i];
        if (!c.taken){
          const vx = Math.round(c.x - camX);
          if (vx + c.r < -50 || vx - c.r > W + 50) continue;
          if (coinImg.complete){
            ctx.drawImage(coinImg, vx - c.r, c.y - c.r, c.r * 2, c.r * 2);
          } else {
            ctx.beginPath();
            ctx.arc(vx, c.y, c.r, 0, Math.PI*2);
            ctx.fillStyle = '#f4d03f';
            ctx.fill();
            ctx.strokeStyle = '#c9a227';
            ctx.stroke();
          }
        }
      }

      // Powerups
      for (const pw of state.powerups) {
        const pwX = Math.round(pw.x - camX);
        if (pwX + pw.w < 0 || pwX > W) continue;
        
        if (pw.type === 'health') {
          // Dibujar botiquín de salud
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(pwX, pw.y, pw.w, pw.h);
          
          // Cruz roja
          ctx.fillStyle = '#ff0000';
          const crossWidth = pw.w * 0.6;
          const crossHeight = pw.h * 0.2;
          // Barra horizontal
          ctx.fillRect(pwX + pw.w * 0.2, pw.y + pw.h * 0.4, crossWidth, crossHeight);
          // Barra vertical
          ctx.fillRect(pwX + pw.w * 0.4, pw.y + pw.h * 0.2, crossHeight, crossWidth);
          
          // Efecto de brillo
          const glowPhase = (state.frames % 60) / 60;
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + glowPhase * 0.5})`;
          ctx.lineWidth = 2;
          ctx.strokeRect(pwX - 2, pw.y - 2, pw.w + 4, pw.h + 4);
        }
      }

      // Bebé Facundo (dibujar antes que Daniela para que aparezca detrás)
      const b = state.baby;
      const babyDrawX = Math.round(b.x - camX);
      
      if (b.sprite && b.sprite.length > 0) {
        const babyImg = b.sprite[b.frameIndex] || b.sprite[0];
        if (babyImg && babyImg.complete) {
          ctx.save();
          if (b.flip) {
            ctx.translate(babyDrawX + b.w, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(babyImg, 0, 0, babyImg.naturalWidth, babyImg.naturalHeight, 0, b.y, b.w, b.h);
          } else {
            ctx.drawImage(babyImg, 0, 0, babyImg.naturalWidth, babyImg.naturalHeight, babyDrawX, b.y, b.w, b.h);
          }
          ctx.restore();
        } else {
          // Fallback para bebé
          ctx.fillStyle = '#64b5f6';
          ctx.fillRect(babyDrawX, b.y, b.w, b.h);
        }
      }
      
      // Jugador
      const p = state.player;
      const spr = state.sprite;
      const drawX = Math.round(p.x - camX);
      
      // Efecto de invulnerabilidad (parpadeo)
      if (p.invulnerable > 0 && Math.floor(p.invulnerable / 8) % 2 === 0) {
        ctx.globalAlpha = 0.5;
      }
      
      if (spr.loaded && spr.images.length){
        const img = spr.images[spr.frameIndex] || spr.images[0];
        // Ajustar el dibujo del sprite para que se alinee mejor con el hitbox
        const spriteOffsetY = -2; // Pequeño ajuste vertical para mejor alineación
        const spriteW = p.w * 1.1; // Sprite ligeramente más ancho que hitbox
        const spriteH = p.h * 1.05; // Sprite ligeramente más alto
        const spriteOffsetX = -p.w * 0.05; // Centrar el sprite más ancho
        
        ctx.save();
        if (p.facing === -1){
          ctx.translate(drawX + p.w, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 
                       spriteOffsetX, p.y + spriteOffsetY, spriteW, spriteH);
        } else {
          ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 
                       drawX + spriteOffsetX, p.y + spriteOffsetY, spriteW, spriteH);
        }
        ctx.restore();
      } else {
        ctx.fillStyle = '#90caf9';
        ctx.fillRect(drawX, p.y, p.w, p.h);
      }
      
      ctx.globalAlpha = 1.0; // Restaurar alpha

      // Enemigos
      for (const e of state.enemies){
        if (!e.alive) continue;
        const vx = Math.round(e.x - camX);
        if (vx + e.w < 0 || vx > W) continue;

        if (e.type === 'flaitaneke') {
          // Renderizar Flaitaneke con sus animaciones especiales
          let spriteArray;
          switch(e.state) {
            case 'combo':
              spriteArray = state.enemySprites.flaitaneke.combo;
              break;
            case 'shoot':
              spriteArray = state.enemySprites.flaitaneke.shoot;
              break;
            default:
              spriteArray = state.enemySprites.flaitaneke.idle;
          }
          
          const img = spriteArray[e.frameIndex] || spriteArray[0];
          if (img && img.complete && img.naturalWidth > 0) {
            ctx.save();
            
            // Siempre mira hacia el jugador
            const facingPlayer = p.x > e.x ? 1 : -1;
            
            if (facingPlayer === -1) {
              ctx.translate(vx + e.w, 0);
              ctx.scale(-1, 1);
              ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, e.y, e.w, e.h);
            } else {
              ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, vx, e.y, e.w, e.h);
            }
            
            ctx.restore();
          } else {
            // Fallback
            ctx.fillStyle = '#9c27b0';
            ctx.fillRect(vx, e.y, e.w, e.h);
          }
        } else {
          // Renderizado normal para otros enemigos
        const imgs = state.enemySprites[e.type];
        const img = imgs ? imgs[e.frameIndex] : null;
          if (img && img.complete && img.naturalWidth > 0) {
            ctx.save();
            
            const facing = e.vx < 0 ? -1 : 1;
            
            if (facing === -1) {
              ctx.translate(vx + e.w, 0);
              ctx.scale(-1, 1);
              ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, e.y, e.w, e.h);
        } else {
              ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, vx, e.y, e.w, e.h);
            }
            
            ctx.restore();
          } else {
            let fallbackColor = '#e57373';
            switch(e.type) {
              case 'martin': fallbackColor = '#ff5722'; break;
              case 'facundo': fallbackColor = '#2196f3'; break;
              default: fallbackColor = '#e57373'; break;
            }
            ctx.fillStyle = fallbackColor;
          ctx.fillRect(vx, e.y, e.w, e.h);
          }
        }
        
        // Mostrar barra de salud para TODOS los enemigos
        if (e.health > 0 && e.maxHealth) {
          const healthPercent = e.health / e.maxHealth;
          const barY = e.y - 10;
          const barHeight = 4;
          
          // Fondo de la barra
          ctx.fillStyle = '#000000';
          ctx.fillRect(vx - 1, barY - 1, e.w + 2, barHeight + 2);
          
          // Barra de salud
          if (healthPercent > 0.6) {
            ctx.fillStyle = '#4caf50'; // Verde
          } else if (healthPercent > 0.3) {
            ctx.fillStyle = '#ff9800'; // Naranja
          } else {
            ctx.fillStyle = '#ff4444'; // Rojo
          }
          ctx.fillRect(vx, barY, e.w * healthPercent, barHeight);
        }
      }
      
      // Renderizar proyectiles
      for (const proj of state.projectiles) {
        const projX = Math.round(proj.x - camX);
        if (projX + proj.w < 0 || projX > W) continue;
        
        if (proj.from === 'player') {
          // Proyectiles del jugador - azul brillante
          ctx.fillStyle = '#00e5ff';
          ctx.fillRect(projX, proj.y, proj.w, proj.h);
          
          // Efecto de brillo
          ctx.fillStyle = '#64ffff';
          ctx.fillRect(projX + 2, proj.y + 2, proj.w - 4, proj.h - 4);
        } else {
          // Proyectiles enemigos - amarillo
          ctx.fillStyle = '#ffeb3b';
          ctx.fillRect(projX, proj.y, proj.w, proj.h);
          
          // Efecto de brillo
          ctx.fillStyle = '#fff59d';
          ctx.fillRect(projX + 2, proj.y + 2, proj.w - 4, proj.h - 4);
        }
      }

      // Meta (bandera/polo)
      const flagX = Math.round(state.endX - camX);
      if (flagX > -10 && flagX < W + 10){
        const flagHeight = 220; // Altura ajustada para el nuevo tamaño
        ctx.fillStyle = '#cfd8dc';
        ctx.fillRect(flagX, groundY - flagHeight, 10, flagHeight);
        ctx.fillStyle = '#4dd0e1';
        ctx.beginPath();
        ctx.moveTo(flagX + 10, groundY - flagHeight);
        ctx.lineTo(flagX + 10 + 40, groundY - flagHeight + 15);
        ctx.lineTo(flagX + 10, groundY - flagHeight + 30);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Inicializar HUD con valores actuales
    setText(UI.coins, state.player.coins);
    setText(UI.score, state.player.score);
    updateFlightUI();
    updateHealthUI();

    // Iniciar
    requestAnimationFrame(step);

    // Inicializar controles táctiles automáticamente si es necesario
    window.addEventListener('load', () => {
      if (shouldShowTouchControls()) {
        console.log('Inicializando controles táctiles automáticamente...');
        // Inicializar antes de que empiece el juego
        const mobileControls = document.querySelector('.mobile-controls');
        if (mobileControls) {
          mobileControls.classList.add('show');
          mobileControls.style.display = 'block';
          console.log('Controles móviles mostrados al cargar');
        }
        // Inicializar el canvas de controles
        setTimeout(() => {
          if (!touchControls.initialized) {
            initTouchControls();
          }
        }, 200);
      }
    });



    // Exponer utilidades en window para depurar en consola si lo deseas
    window.__GAME__ = {
      state,
      resetGame,
      setPlayerSprite: (opts) => {
        Object.assign(state.sprite, opts || {});
      }
    };
  });
  
  // Inicializar controles táctiles globalmente
  window.addEventListener('load', () => {
    console.log('Window load event - verificando controles táctiles...');
    const isTouchDevice = ('ontouchstart' in window) || 
                         (navigator.maxTouchPoints > 0) ||
                         (window.matchMedia('(pointer: coarse)').matches) ||
                         (window.innerWidth <= 1366);
                         
    if (isTouchDevice) {
      console.log('Dispositivo táctil detectado!');
      const mobileControls = document.querySelector('.mobile-controls');
      if (mobileControls) {
        mobileControls.style.display = 'block';
        mobileControls.classList.add('show');
        console.log('Controles móviles mostrados en window load');
      }
    }
  });
})();
