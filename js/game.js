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
      canvas: byId('game'),
      testsOut: byId('test-output'),
      mainMenu: byId('mainMenu'),
      startButton: byId('startButton'),
      btnLeft: byId('btn-left'),
      btnRight: byId('btn-right'),
      btnJump: byId('btn-jump'),
      btnRun: byId('btn-run'),
      btnFullscreen: byId('btn-fullscreen')
    };

    // --- Audio --------------------------------------------------------------
    const mainMusic = new Audio('audio/main.mp3');
    mainMusic.loop = true;

    const coinSound = new Audio('audio/coin-on.mp3');

    // --- Estado del juego ----------------------------------------------------
    const ctx = UI.canvas.getContext('2d', { alpha: false });
    // Mejor para pixel art
    ctx.imageSmoothingEnabled = false;
    const W = UI.canvas.width, H = UI.canvas.height;
    // Subimos el suelo lógico para que el personaje quede más alto en pantalla
    const groundY = H - 85;
    const skyY = 12; // techo lógico para no salir por arriba

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
        x: 120, y: groundY - 40, w: 28, h: 40,
        vx: 0, vy: 0,
        speed: 2.0,
        onGround: true,
        facing: 1,
        coins: 0,
        score: 0,
        flight: 100,
        flightMax: 100,
        flyPower: 0.5,      // empuje vertical por frame cuando vuela (más suave)
        gravity: 0.5,
        maxAscendSpeed: 3.2,
        jump: 9.0
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
        speed: 6,
        current: 'idle'
      },
      coins: [], platforms: [], blocks: [], enemies: [], enemySprites: {}
    };

    const levels = [
      { // Nivel 1
        worldWidth: 3200, endX: 3000,
        coins: [
          {x: 360, y: groundY - 120, r: 10}, {x: 520, y: groundY - 60, r: 10},
          {x: 780, y: groundY - 160, r: 10}, {x: 1200, y: groundY - 120, r: 10},
          {x: 1400, y: groundY - 160, r: 10}, {x: 1650, y: groundY - 100, r: 10}
        ],
        platforms: [
          {x: 300, y: groundY - 20, w: 160, h: 12}, {x: 700, y: groundY - 70, w: 120, h: 12},
          {x: 1100, y: groundY - 40, w: 180, h: 12}, {x: 1500, y: groundY - 90, w: 160, h: 12},
          {x: 1900, y: groundY - 60, w: 140, h: 12}, {x: 2300, y: groundY - 110, w: 200, h: 12}
        ],
        blocks: [
          {x: 600, y: groundY - 120, w: 24, h: 24, type: 'question', state: 'full'},
          {x: 624, y: groundY - 120, w: 24, h: 24, type: 'brick', state: 'solid'},
          {x: 648, y: groundY - 120, w: 24, h: 24, type: 'brick', state: 'solid'},
          {x: 1200, y: groundY - 160, w: 24, h: 24, type: 'question', state: 'full'},
          {x: 1450, y: groundY - 200, w: 24, h: 24, type: 'brick', state: 'solid'}
        ],
        enemies: [
          {type: 'default', x: 900, y: groundY - 24, w: 24, h: 24, vx: -0.6, patrolLeft: 860, patrolRight: 1000},
          {type: 'facundo', x: 1700, y: groundY - 24, w: 24, h: 24, vx: -0.7, patrolLeft: 1660, patrolRight: 1780}
        ]
      },
      { // Nivel 2
        worldWidth: 4000, endX: 3800,
        coins: [
          {x: 400, y: groundY - 150, r: 10}, {x: 600, y: groundY - 200, r: 10},
          {x: 900, y: groundY - 100, r: 10}, {x: 1500, y: groundY - 250, r: 10},
          {x: 2000, y: groundY - 80, r: 10}, {x: 2500, y: groundY - 180, r: 10},
          {x: 3000, y: groundY - 220, r: 10}, {x: 3500, y: groundY - 120, r: 10}
        ],
        platforms: [
          {x: 200, y: groundY - 40, w: 100, h: 12}, {x: 550, y: groundY - 90, w: 150, h: 12},
          {x: 800, y: groundY - 140, w: 200, h: 12}, {x: 1200, y: groundY - 190, w: 120, h: 12},
          {x: 1800, y: groundY - 70, w: 250, h: 12}, {x: 2400, y: groundY - 150, w: 180, h: 12},
          {x: 2900, y: groundY - 200, w: 200, h: 12}, {x: 3400, y: groundY - 90, w: 150, h: 12}
        ],
        blocks: [
          {x: 600, y: groundY - 240, w: 24, h: 24, type: 'question', state: 'full'},
          {x: 1500, y: groundY - 290, w: 24, h: 24, type: 'question', state: 'full'},
          {x: 2200, y: groundY - 120, w: 24, h: 24, type: 'brick', state: 'solid'},
          {x: 2224, y: groundY - 120, w: 24, h: 24, type: 'brick', state: 'solid'}
        ],
        enemies: [
          {type: 'default', x: 500, y: groundY - 24, w: 24, h: 24, vx: -0.8, patrolLeft: 450, patrolRight: 650},
          {type: 'facundo', x: 1000, y: groundY - 24, w: 24, h: 24, vx: -0.6, patrolLeft: 950, patrolRight: 1150},
          {type: 'default', x: 1600, y: groundY - 24, w: 24, h: 24, vx: 0.7, patrolLeft: 1550, patrolRight: 1750},
          {type: 'martin', x: 2600, y: groundY - 24, w: 24, h: 24, vx: -0.9, patrolLeft: 2500, patrolRight: 2800}
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
      tryJpg.src = 'paisaje.jpg';
    };
    bgImg.onload = () => {
      state.bg.loaded = true;
      state.bg.image = bgImg;
      state.bg.scale = UI.canvas.height / bgImg.naturalHeight;
      state.bg.tileW = Math.ceil(bgImg.naturalWidth * state.bg.scale);
      state.bg.tileH = Math.ceil(bgImg.naturalHeight * state.bg.scale);
    };
    bgImg.onerror = tryJpgIfPngFails;
    bgImg.src = 'paisaje.png';

    // Cargar sprites de enemigos
    const enemySpriteTypes = ['martin', 'facundo'];
    state.enemySprites = {};
    enemySpriteTypes.forEach(t => {
      const img1 = new Image();
      img1.src = `sprites/${t}/1.png`;
      const img2 = new Image();
      img2.src = `sprites/${t}/2.png`;
      state.enemySprites[t] = [img1, img2];
    });

    // --- Input ----------------------------------------------------------------
    const kmap = {
      'ArrowLeft':'left','ArrowRight':'right',
      'a':'left','d':'right',
      ' ':'jump','Space':'jump','Spacebar':'jump','z':'jump','Z':'jump',
      'Shift':'run','x':'run','X':'run',
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
    function handleTouchEvent(key, isPressed, e) {
      state.keys[key] = isPressed;
      e.preventDefault();
      e.stopPropagation();
    }

    UI.btnLeft.addEventListener('touchstart', (e) => handleTouchEvent('left', true, e));
    UI.btnLeft.addEventListener('touchend', (e) => handleTouchEvent('left', false, e));
    UI.btnRight.addEventListener('touchstart', (e) => handleTouchEvent('right', true, e));
    UI.btnRight.addEventListener('touchend', (e) => handleTouchEvent('right', false, e));
    UI.btnJump.addEventListener('touchstart', (e) => handleTouchEvent('jump', true, e));
    UI.btnJump.addEventListener('touchend', (e) => handleTouchEvent('jump', false, e));
    UI.btnRun.addEventListener('touchstart', (e) => handleTouchEvent('run', true, e));
    UI.btnRun.addEventListener('touchend', (e) => handleTouchEvent('run', false, e));
    UI.btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        UI.canvas.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    });

    UI.startButton.addEventListener('click', () => {
      UI.mainMenu.classList.add('hidden');
      loadLevel(0);
      state.running = true;
      state.gameStarted = true;
      mainMusic.play();
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
      state.enemies = JSON.parse(JSON.stringify(level.enemies));

      // Guardar estado inicial para reseteos
      state.blocks.forEach(b => b.initState = b.state);
      state.enemies.forEach(e => {
          e.sx = e.x;
          e.sy = e.y;
          e.svx = e.vx;
          e.alive = true;
          e.frameIndex = 0;
          e.frameCounter = 0;
          e.animSpeed = 20;
      });

      resetPlayer();
      state.cameraX = 0;
      updateFlightUI();
    }

    function resetPlayer() {
      const p = state.player;
      p.x = 120; p.y = groundY - p.h; p.vx = 0; p.vy = 0; p.onGround = true;
      p.flight = p.flightMax;
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
      // Restablece el nivel actual
      loadLevel(state.currentLevel);
      // Restablece puntaje y monedas
      state.player.coins = 0;
      state.player.score = 0;
      setText(UI.coins, state.player.coins);
      setText(UI.score, state.player.score);
    }

    function updateFlightUI(){
      const p = state.player;
      clampFlight();
      const pct = Math.round((p.flight / p.flightMax) * 100);
      setText(UI.flightText, pct + '%');
      UI.flightBar.style.width = pct + '%';
    }

    function rectsOverlap(ax,ay,aw,ah, bx,by,bw,bh){
      return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
    }

    // --- Loop -----------------------------------------------------------------
    function step(){
      if (!state.running) { requestAnimationFrame(step); return; }
      state.frames++;

      const p = state.player;
      const run = state.keys.run ? 1.5 : 1.0;
      p.vx = 0;
      if (state.keys.left)  p.vx = -p.speed * run;
      if (state.keys.right) p.vx =  p.speed * run;
      if (state.keys.left && !state.keys.right) p.facing = -1;
      else if (state.keys.right && !state.keys.left) p.facing = 1;

      // Saltar
      if (state.keys.jump && p.onGround){
        p.vy = -p.jump;
        p.onGround = false;
      }

      // Gravedad + vuelo
      if (!p.onGround){
        // Volar (planear/aletear) si queda energía
        if (state.keys.jump && p.flight > 0){
          p.vy -= p.flyPower;    // empuje hacia arriba
          p.flight -= 0.6;       // gasta energía
        }
        p.vy += p.gravity;       // gravedad
        // Limitar velocidad vertical ascendente
        if (p.vy < -p.maxAscendSpeed) p.vy = -p.maxAscendSpeed;
      }

      // Movimiento
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

      // Recarga de vuelo en el suelo
      if (p.onGround){
        p.flight += 0.8;
        clampFlight();
      }
      updateFlightUI();

      // Colisiones con plataformas y bloques (tope superior sencillo)
      const solids = state.platforms.concat(state.blocks);
      for (const s of solids){
        if (rectsOverlap(p.x, p.y, p.w, p.h, s.x, s.y, s.w, s.h)){
          // Cae desde arriba
          if (p.vy >= 0 && p.y + p.h - p.vy <= s.y){
            p.y = s.y - p.h;
            p.vy = 0;
            p.onGround = true;
          }
        }
      }

      // Golpe desde abajo a bloques
      if (p.vy < 0){
        for (const b of state.blocks){
          if (rectsOverlap(p.x, p.y, p.w, p.h, b.x, b.y, b.w, b.h)){
            if (p.y <= b.y + b.h && p.y + p.h >= b.y + b.h){
              // Reposicionar debajo del bloque y cancelar salto
              p.y = b.y + b.h;
              p.vy = 0;
              // Interacciones
              if (b.type === 'question' && b.state !== 'empty'){
                addCoins(1);
                b.state = 'empty';
              }
              // Los ladrillos quedan sólidos sin romperse en esta versión
            }
          }
        }
      }

      // IA básica de enemigos (patrulla horizontal)
      for (const e of state.enemies){
        if (!e.alive) continue;
        e.x += e.vx;
        if (e.x < e.patrolLeft){ e.x = e.patrolLeft; e.vx *= -1; }
        if (e.x + e.w > e.patrolRight){ e.x = e.patrolRight - e.w; e.vx *= -1; }
        e.frameCounter++;
        if (e.frameCounter >= e.animSpeed){
          e.frameCounter = 0;
          e.frameIndex = (e.frameIndex + 1) % 2;
        }
        // Colisión con jugador
        if (rectsOverlap(p.x, p.y, p.w, p.h, e.x, e.y, e.w, e.h)){
          const stompFromAbove = p.vy > 0 && (p.y + p.h - p.vy) <= e.y;
          if (stompFromAbove){
            e.alive = false;
            p.vy = -6; // rebote
            state.player.score += 200;
            setText(UI.score, state.player.score);
          } else {
            // Daño simple: reiniciar
            resetGame();
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

      // Recoger monedas
      for (const c of state.coins){
        if (!c.taken){
          const dx = (p.x + p.w/2) - c.x;
          const dy = (p.y + p.h/2) - c.y;
          if (Math.hypot(dx,dy) < c.r + Math.max(p.w,p.h)/2 * 0.6){
            c.taken = true;
            addCoins(1);
          }
        }
      }

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
        if (b.type === 'question'){
          ctx.fillStyle = (b.state === 'empty') ? '#5c5c5c' : '#d4a133';
        } else {
          ctx.fillStyle = '#8d6e63';
        }
        ctx.fillRect(vx, b.y, b.w, b.h);
      }

      // Monedas
      for (const c of state.coins){
        if (!c.taken){
          const vx = Math.round(c.x - camX);
          if (vx + c.r < 0 || vx - c.r > W) continue;
          ctx.beginPath();
          ctx.arc(vx, c.y, c.r, 0, Math.PI*2);
          ctx.fillStyle = '#f4d03f';
          ctx.fill();
          ctx.strokeStyle = '#c9a227';
          ctx.stroke();
        }
      }

      // Jugador
      const p = state.player;
      const spr = state.sprite;
      const drawX = Math.round(p.x - camX);
      if (spr.loaded && spr.images.length){
        const img = spr.images[spr.frameIndex] || spr.images[0];
        ctx.save();
        if (p.facing === -1){
          ctx.translate(drawX + p.w, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, p.y, p.w, p.h);
        } else {
          ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, drawX, p.y, p.w, p.h);
        }
        ctx.restore();
      } else {
        ctx.fillStyle = '#90caf9';
        ctx.fillRect(drawX, p.y, p.w, p.h);
      }

      // Enemigos
      for (const e of state.enemies){
        if (!e.alive) continue;
        const vx = Math.round(e.x - camX);

        // Ajustar tamaño según tipo
        let width = e.w;
        let height = e.h;
        switch (e.type) {
          case 'martin':
            width = 48;
            height = 48;
            break;
          case 'facundo':
            width = 36;
            height = 36;
            break;
        }

        if (vx + width < 0 || vx > W) continue;

        // Usar 'y' ajustada para que los enemigos más grandes sigan en el suelo
        const adjustedY = e.y - (height - e.h);

        const imgs = state.enemySprites[e.type];
        const img = imgs ? imgs[e.frameIndex] : null;
        if (img && img.complete) {
          ctx.drawImage(img, vx, adjustedY, width, height);
        } else {
          ctx.fillStyle = '#e57373';
          ctx.fillRect(vx, adjustedY, width, height);
        }
      }

      // Meta (bandera/polo)
      const flagX = Math.round(state.endX - camX);
      if (flagX > -10 && flagX < W + 10){
        ctx.fillStyle = '#cfd8dc';
        ctx.fillRect(flagX, groundY - 140, 6, 140);
        ctx.fillStyle = '#4dd0e1';
        ctx.beginPath();
        ctx.moveTo(flagX + 6, groundY - 140);
        ctx.lineTo(flagX + 6 + 24, groundY - 130);
        ctx.lineTo(flagX + 6, groundY - 120);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Inicializar HUD con valores actuales
    setText(UI.coins, state.player.coins);
    setText(UI.score, state.player.score);
    updateFlightUI();

    // Iniciar
    requestAnimationFrame(step);

    // --- Test Runner ----------------------------------------------------------
    (function runTests(){
      const log = (name, ok, err) => {
        const line = (ok ? '✔️ ' : '❌ ') + name + (ok ? '' : ' -> ' + err);
        UI.testsOut.textContent += '\n' + (ok ? line : line);
        const span = document.createElement('span');
        span.className = ok ? 'pass' : 'fail';
        span.textContent = line;
        UI.testsOut.appendChild(span);
      };

      function t(name, fn){
        try { fn(); log(name, true); }
        catch(e){ log(name, false, e.message || String(e)); }
      }

      // Tests mínimos de DOM/UI
      t('Existe #coins', () => { if (!(UI.coins instanceof HTMLElement)) throw new Error('No existe #coins'); });
      t('Existe #score', () => { if (!(UI.score instanceof HTMLElement)) throw new Error('No existe #score'); });
      t('Existe barra de vuelo', () => { if (!(UI.flightBar instanceof HTMLElement)) throw new Error('No existe #flightBar'); });

      // Test de actualización de texto segura
      t('setText actualiza #coins sin errores', () => {
        setText(UI.coins, '7');
        if (UI.coins.textContent !== '7') throw new Error('textContent no coincide');
      });

      // Test de lógica de monedas -> UI
      t('addCoins incrementa estado y HUD', () => {
        const before = state.player.coins;
        addCoins(1);
        if (state.player.coins !== before + 1) throw new Error('Estado coins no incrementó');
        if (UI.coins.textContent !== String(state.player.coins)) throw new Error('HUD coins no sincronizado');
      });

      // Test de límites de vuelo
      t('clampFlight limita a [0, flightMax]', () => {
        state.player.flight = -5; clampFlight();
        if (state.player.flight !== 0) throw new Error('No limitó a 0');
        state.player.flight = state.player.flightMax + 10; clampFlight();
        if (state.player.flight !== state.player.flightMax) throw new Error('No limitó a flightMax');
      });

      // Test de loop (al menos un frame renderizado)
      setTimeout(() => {
        t('El loop de juego avanzó frames', () => {
          if (state.frames <= 0) throw new Error('No se renderizó ningún frame');
        });
      }, 120);
    })();

    // Exponer utilidades en window para depurar en consola si lo deseas
    window.__GAME__ = {
      state,
      resetGame,
      setPlayerSprite: (opts) => {
        Object.assign(state.sprite, opts || {});
      }
    };
  });
})();
