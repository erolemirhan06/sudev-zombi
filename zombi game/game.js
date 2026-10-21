// game.js - 5x5 Zombie Platform Game Engine using Three.js

// Configuration & Constants
const GRID_COLS = 5;
const GRID_ROWS = 6;
const CELL_SIZE = 2.4; // Distance between cell centers
const LEVEL_SPEED_INCREASE = 0.22;
const BASE_ZOMBIE_SCORE = 20;
const SCORE_PER_SPEED_TIER = 20;
const MAX_ZOMBIE_SCORE = 100;
const HALF_GRID_X = ((GRID_COLS - 1) * CELL_SIZE) / 2; // (4 * 2.4) / 2 = 4.8
const HALF_GRID_Z = ((GRID_ROWS - 1) * CELL_SIZE) / 2; // 6.0
const PLATFORM_HALF_WIDTH = HALF_GRID_X + CELL_SIZE * 0.55; // Boundary to fall off
const PLATFORM_HALF_DEPTH = HALF_GRID_Z + CELL_SIZE * 0.55;

// Color palettes for levels
const LEVEL_PALETTES = [
  { name: 'Neon Cyber', tileColor: 0x1f1147, edgeColor: 0x00f0ff, accent: 0xff007f },
  { name: 'Solar Sunset', tileColor: 0x3d0b37, edgeColor: 0xff5e00, accent: 0xffd000 },
  { name: 'Acid Jungle', tileColor: 0x072b22, edgeColor: 0x39ff14, accent: 0x00ffff },
  { name: 'Crimson Abyss', tileColor: 0x300511, edgeColor: 0xff0055, accent: 0xffffff },
  { name: 'Electric Violet', tileColor: 0x160033, edgeColor: 0xbe00fe, accent: 0x00f0ff }
];

class ZombieGame {
  constructor() {
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('zombie_platform_highscore') || '0', 10);
    this.level = 1;
    this.killsThisLevel = 0;
    this.totalKills = 0;
    this.missedZombies = 0;
    const MAX_MISSES = 10;
    this.MAX_MISSES = MAX_MISSES;
    this.state = 'START'; // 'START', 'PLAYING', 'PAUSED', 'GAMEOVER'
    this.combo = 0;
    this.comboTimer = 0;

    // Movement & Spawning Parameters
    this.baseSpeed = 0.85;
    this.currentSpeed = this.baseSpeed;
    this.spawnInterval = 2800; // ms between zombie spawns
    this.lastSpawnTime = 0;
    this.maxActiveZombies = 3;

    // Player State
    this.playerCol = 2; // Center column (0..4)
    this.playerX = 0;
    this.targetPlayerX = 0;
    this.canShoot = true;
    this.shootCooldown = 280; // ms
    this.lastShootTime = 0;
    this.weaponLevel = 1;
    this.weaponDamage = 1;
    this.projectileSpeed = 24;

    // 3D Scene components
    this.container = document.getElementById('canvas-container');
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Scene entities
    this.tiles = []; // 5x5 tile meshes
    this.playerMesh = null;
    this.zombies = [];
    this.projectiles = [];
    this.particles = [];
    this.floatingClouds = [];
    this.crosshairMesh = null;

    // DOM Elements
    this.scoreEl = document.getElementById('score-val');
    this.highScoreEl = document.getElementById('high-score-val');
    this.levelEl = document.getElementById('level-val');
    this.heartsEl = document.getElementById('hearts-container');
    this.startModal = document.getElementById('start-modal');
    this.gameoverModal = document.getElementById('gameover-modal');
    this.pauseModal = document.getElementById('pause-modal');
    this.floatingTextContainer = document.getElementById('floating-text-container');
    this.announcementEl = document.getElementById('center-announcement');
    this.weaponUpgradeEl = document.getElementById('weapon-upgrade-notice');
    this.screenFlashEl = document.getElementById('screen-flash');

    this.init3D();
    this.initHUD();
    this.bindEvents();
    this.updateHUD();

    // Start render loop
    this.lastFrameTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  // Convert (col, row) [0..4] to 3D World (X, Z)
  gridToWorld(col, row) {
    const x = (col - (GRID_COLS - 1) / 2) * CELL_SIZE;
    const z = (row - (GRID_ROWS - 1) / 2) * CELL_SIZE;
    return { x, z };
  }

  // Convert 3D World X to closest column (0..4)
  worldToCol(x) {
    const col = Math.round(x / CELL_SIZE) + 2;
    return Math.max(0, Math.min(4, col));
  }

  init3D() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x280b45, 0.018);

    // Camera
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(48, aspect, 0.1, 200);
    this.cameraDefaultPos = new THREE.Vector3(0, 14, 18);
    this.camera.position.copy(this.cameraDefaultPos);
    this.camera.lookAt(0, 0, -0.5);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.2);
    dirLight.position.set(12, 22, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 5;
    dirLight.shadow.camera.far = 45;
    dirLight.shadow.camera.left = -12;
    dirLight.shadow.camera.right = 12;
    dirLight.shadow.camera.top = 12;
    dirLight.shadow.camera.bottom = -12;
    this.scene.add(dirLight);

    // Colorful point lights underneath for dynamic neon rim effect
    this.neonLight1 = new THREE.PointLight(0x00f0ff, 2.5, 25);
    this.neonLight1.position.set(-6, -2, -4);
    this.scene.add(this.neonLight1);

    this.neonLight2 = new THREE.PointLight(0xff007f, 2.5, 25);
    this.neonLight2.position.set(6, -2, 4);
    this.scene.add(this.neonLight2);

    // Build Floating 5x5 Platform
    this.createPlatform();

    // Build Player Cannon / Defender
    this.createPlayer();

    // Crosshair Indicator
    this.createCrosshair();

    // Ambient floating elements (vibrant low-poly clouds/crystals in void)
    this.createAmbientDecor();
  }

  createPlatform() {
    this.platformGroup = new THREE.Group();
    this.tiles = [];

    const tileGeo = new THREE.BoxGeometry(CELL_SIZE * 0.92, 0.5, CELL_SIZE * 0.92);

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const { x, z } = this.gridToWorld(c, r);

        // Vibrant tile material with glowing edges
        const palette = LEVEL_PALETTES[(this.level - 1) % LEVEL_PALETTES.length];
        const isChecker = (r + c) % 2 === 0;

        const tileMat = new THREE.MeshStandardMaterial({
          color: isChecker ? palette.tileColor : new THREE.Color(palette.tileColor).multiplyScalar(1.3),
          roughness: 0.35,
          metalness: 0.25,
          emissive: palette.edgeColor,
          emissiveIntensity: 0.08
        });

        const tileMesh = new THREE.Mesh(tileGeo, tileMat);
        tileMesh.position.set(x, -0.25, z);
        tileMesh.receiveShadow = true;
        tileMesh.userData = { col: c, row: r, origY: -0.25, currentScaleY: 1 };

        // Glowing Wireframe border for neon arcade feel
        const wireGeo = new THREE.EdgesGeometry(tileGeo);
        const wireMat = new THREE.LineBasicMaterial({
          color: palette.edgeColor,
          linewidth: 2,
          transparent: true,
          opacity: 0.75
        });
        const wireframe = new THREE.LineSegments(wireGeo, wireMat);
        wireframe.visible = false;
        tileMesh.add(wireframe);

        this.platformGroup.add(tileMesh);
        this.tiles.push({ mesh: tileMesh, col: c, row: r, mat: tileMat, wireMat: wireMat });
      }
    }

    // Platform Base / Underside floating foundation
    const foundationSizeX = GRID_COLS * CELL_SIZE - 0.2;
    const foundationSizeZ = GRID_ROWS * CELL_SIZE - 0.2;
    const foundationGeo = new THREE.BoxGeometry(foundationSizeX, 1.2, foundationSizeZ);
    const foundationMat = new THREE.MeshStandardMaterial({
      color: 0x110726,
      roughness: 0.7,
      metalness: 0.5
    });
    const foundation = new THREE.Mesh(foundationGeo, foundationMat);
    foundation.position.set(0, -1.0, 0);
    foundation.receiveShadow = true;
    this.platformGroup.add(foundation);

    // Glowing rim border around entire 5x6 platform
    const rimGeo = new THREE.BoxGeometry(foundationSizeX + 0.35, 0.2, foundationSizeZ + 0.35);
    this.rimMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0
    });
    const rim = new THREE.Mesh(rimGeo, this.rimMat);
    rim.position.set(0, 0.05, 0);
    rim.visible = false;
    this.platformGroup.add(rim);

    this.scene.add(this.platformGroup);
  }

  createPlayer() {
    this.playerGroup = new THREE.Group();

    // Stylized Sci-Fi Turret / Blaster
    const baseGeo = new THREE.CylinderGeometry(0.8, 1.1, 0.5, 16);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x22223b,
      metalness: 0.8,
      roughness: 0.2
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.25;
    base.castShadow = true;
    this.playerGroup.add(base);

    // Dome
    const domeGeo = new THREE.SphereGeometry(0.65, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({
      color: 0xff007f,
      emissive: 0xff007f,
      emissiveIntensity: 0.4,
      metalness: 0.5,
      roughness: 0.2
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.position.y = 0.5;
    this.playerGroup.add(dome);

    // Dual Plasma Barrels
    const barrelGeo = new THREE.CylinderGeometry(0.12, 0.14, 1.4, 12);
    const barrelMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      metalness: 0.9,
      roughness: 0.1
    });

    const barrel1 = new THREE.Mesh(barrelGeo, barrelMat);
    barrel1.rotation.x = Math.PI / 2;
    barrel1.position.set(-0.25, 0.55, -0.6);
    barrel1.castShadow = true;

    const barrel2 = new THREE.Mesh(barrelGeo, barrelMat);
    barrel2.rotation.x = Math.PI / 2;
    barrel2.position.set(0.25, 0.55, -0.6);
    barrel2.castShadow = true;

    this.cannonHead = new THREE.Group();
    this.cannonHead.add(barrel1);
    this.cannonHead.add(barrel2);
    this.playerGroup.add(this.cannonHead);

    // Player position stays centered in the 5-wide section and on the front defense row.
    const { x, z } = this.gridToWorld(2, GRID_ROWS - 1);
    this.playerGroup.position.set(x, 0, z + 0.3);
    this.playerX = x;
    this.targetPlayerX = x;

    this.scene.add(this.playerGroup);
  }

  createCrosshair() {
    const ringGeo = new THREE.RingGeometry(0.6, 0.75, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffe600,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    this.crosshairMesh = new THREE.Mesh(ringGeo, ringMat);
    this.crosshairMesh.rotation.x = -Math.PI / 2;
    this.crosshairMesh.position.set(0, 0.05, 0);
    this.scene.add(this.crosshairMesh);
  }

  createAmbientDecor() {
    // Floating vibrant poly crystals and clouds beneath the floating 5x5 platform
    const crystalGeo = new THREE.OctahedronGeometry(1.2, 0);
    const crystalColors = [0xff007f, 0x00f0ff, 0xffe600, 0x39ff14, 0x9d00ff];

    this.floatingDecors = [];
    for (let i = 0; i < 18; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: crystalColors[i % crystalColors.length],
        emissive: crystalColors[i % crystalColors.length],
        emissiveIntensity: 0.3,
        roughness: 0.2,
        metalness: 0.8,
        wireframe: i % 2 === 0
      });
      const crystal = new THREE.Mesh(crystalGeo, mat);

      const angle = (i / 18) * Math.PI * 2;
      const dist = 14 + Math.random() * 12;
      crystal.position.set(
        Math.cos(angle) * dist,
        -6 - Math.random() * 10,
        Math.sin(angle) * dist - 3
      );
      crystal.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      crystal.scale.setScalar(0.7 + Math.random() * 0.9);

      this.scene.add(crystal);
      this.floatingDecors.push({
        mesh: crystal,
        rotSpeed: (Math.random() - 0.5) * 0.03,
        bobSpeed: 1 + Math.random() * 2,
        bobOffset: Math.random() * Math.PI * 2,
        baseY: crystal.position.y
      });
    }
  }

  // --- ZOMBIE CREATION & MANAGEMENT ---
  createZombie(col = null, type = 'normal') {
    if (col === null) {
      col = Math.floor(Math.random() * GRID_COLS);
    }

    // Determine zombie type based on level
    if (this.level >= 4 && Math.random() < 0.30) {
      type = 'tank';
    } else if (this.level >= 2 && Math.random() < 0.40) {
      type = 'runner';
    }

    const zombieGroup = new THREE.Group();

    let skinColor = 0x48bb78; // Vibrant green
    let shirtColor = 0x3182ce;
    let hp = 1;
    let speedMult = 1.0;
    let scale = 1.0;

    if (type === 'runner') {
      skinColor = 0xed8936; // Orange fast runner
      shirtColor = 0xe53e3e;
      speedMult = 1.6;
      scale = 0.85;
    } else if (type === 'tank') {
      skinColor = 0x805ad5; // Big purple tank
      shirtColor = 0x2b6cb0;
      hp = 2;
      speedMult = 0.75;
      scale = 1.35;
    }

    const skinMat = new THREE.MeshStandardMaterial({
      color: skinColor,
      roughness: 0.5,
      metalness: 0.1
    });

    const shirtMat = new THREE.MeshStandardMaterial({
      color: shirtColor,
      roughness: 0.6
    });

    const eyeMat = new THREE.MeshBasicMaterial({
      color: 0xff0033
    });

    // Head
    const headGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.7;
    head.castShadow = true;
    zombieGroup.add(head);

    // Glowing Eyes
    const eyeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.15);
    const eyeLeft = new THREE.Mesh(eyeGeo, eyeMat);
    eyeLeft.position.set(-0.2, 1.8, 0.35);
    const eyeRight = new THREE.Mesh(eyeGeo, eyeMat);
    eyeRight.position.set(0.2, 1.8, 0.35);
    zombieGroup.add(eyeLeft);
    zombieGroup.add(eyeRight);

    // Torso
    const bodyGeo = new THREE.BoxGeometry(0.8, 0.9, 0.45);
    const body = new THREE.Mesh(bodyGeo, shirtMat);
    body.position.y = 1.0;
    body.castShadow = true;
    zombieGroup.add(body);

    // Arms reaching forward towards player
    const armGeo = new THREE.BoxGeometry(0.22, 0.22, 0.8);
    const armL = new THREE.Mesh(armGeo, skinMat);
    armL.position.set(-0.5, 1.1, 0.4);
    armL.castShadow = true;
    const armR = new THREE.Mesh(armGeo, skinMat);
    armR.position.set(0.5, 1.1, 0.4);
    armR.castShadow = true;
    zombieGroup.add(armL);
    zombieGroup.add(armR);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.25, 0.65, 0.25);
    const legL = new THREE.Mesh(legGeo, skinMat);
    legL.position.set(-0.25, 0.32, 0);
    legL.castShadow = true;
    const legR = new THREE.Mesh(legGeo, skinMat);
    legR.position.set(0.25, 0.32, 0);
    legR.castShadow = true;
    zombieGroup.add(legL);
    zombieGroup.add(legR);

    zombieGroup.scale.setScalar(scale);

    // Initial position: Start at back edge of platform (Row 0 or just outside row 0)
    const { x } = this.gridToWorld(col, 0);
    const startZ = -HALF_GRID_Z - 0.5; // Spawn just slightly above row 0
    zombieGroup.position.set(x, 0, startZ);

    this.scene.add(zombieGroup);

    const zombieObj = {
      mesh: zombieGroup,
      head: head,
      armL: armL,
      armR: armR,
      legL: legL,
      legR: legR,
      col: col,
      type: type,
      hp: hp,
      maxHp: hp,
      speed: this.currentSpeed * speedMult,
      state: 'WALKING', // 'WALKING', 'KNOCKED_OFF', 'FALLING'
      walkCycle: Math.random() * 10,
      velocity: new THREE.Vector3(0, 0, 0),
      rotVelocity: new THREE.Vector3(0, 0, 0)
    };

    this.zombies.push(zombieObj);
    return zombieObj;
  }

  // Shoot projectile from player cannon towards target position
  shootAt(targetPos) {
    if (!this.canShoot || this.state !== 'PLAYING') return;

    const now = performance.now();
    if (now - this.lastShootTime < this.shootCooldown) return;
    this.lastShootTime = now;

    if (window.soundController) {
      window.soundController.playShoot();
    }

    // Origin from cannon barrels
    const origin = this.playerGroup.position.clone();
    origin.y += 0.6;
    origin.z -= 0.6;

    // Aim cannon towards target
    const angle = Math.atan2(targetPos.x - this.playerGroup.position.x, targetPos.z - this.playerGroup.position.z);
    this.cannonHead.rotation.y = angle - Math.PI;

    // Target slightly elevated to hit zombie torso
    const elevatedTarget = targetPos.clone();
    if (elevatedTarget.y < 0.6) elevatedTarget.y = 0.8;

    // Direction vector towards target
    const dir = new THREE.Vector3().subVectors(elevatedTarget, origin).normalize();

    // Create glowing plasma projectile with power scaling from weapon level
    const projectileScale = 1 + (this.weaponLevel - 1) * 0.18;
    const projGeo = new THREE.SphereGeometry(0.24 * projectileScale, 12, 12);
    const projMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x00f0ff).lerp(new THREE.Color(0xff007f), Math.min(1, (this.weaponLevel - 1) * 0.2))
    });
    const proj = new THREE.Mesh(projGeo, projMat);
    proj.position.copy(origin);

    // Glowing point light attached to projectile
    const pLight = new THREE.PointLight(0x00f0ff, 2.0, 6 + (this.weaponLevel * 2));
    proj.add(pLight);

    this.scene.add(proj);

    this.projectiles.push({
      mesh: proj,
      velocity: dir.multiplyScalar(this.projectileSpeed),
      birthTime: now,
      alive: true,
      damage: this.weaponDamage
    });

    // Cannon recoil animation
    this.cannonHead.position.z += 0.22;
    setTimeout(() => {
      this.cannonHead.position.z = 0;
    }, 80);
  }

  // Knock a zombie with physics impulse
  hitZombie(zombie, hitPoint, projectileVelocity, projectileDamage = 1) {
    zombie.hp -= projectileDamage;

    // Particle burst at hit point
    this.createExplosion(hitPoint, 0x00f0ff, 16);

    if (window.soundController) {
      window.soundController.playHit();
    }

    if (zombie.hp > 0) {
      // Tank zombie absorbed hit: push back one tile and wobble
      zombie.mesh.position.z -= CELL_SIZE * 0.9;
      this.createFloatingText(hitPoint, "💥 DARBE! (" + zombie.hp + " KALDI)", "bonus");
      this.addScore(50);
      return;
    }

    // Zombie is defeated / launched off the platform!
    zombie.state = 'KNOCKED_OFF';

    // Knockback physics impulse:
    // Pushes zombie vigorously back (negative Z) and outward (left/right) towards nearest edge, plus upward arc!
    const sideDir = zombie.mesh.position.x >= 0 ? 1.0 : -1.0;
    const xDistFromCenter = Math.abs(zombie.mesh.position.x);
    // Extra boost if near center so it definitely flies off the edge
    const xBoost = xDistFromCenter < 1.0 ? 8.0 : 6.0;

    zombie.velocity.set(
      sideDir * (xBoost + Math.random() * 3),
      7.5 + Math.random() * 2.5, // High arc into the air
      -(7.0 + Math.random() * 3.5) // Pushed hard towards back edge
    );

    // Random tumbling spin
    zombie.rotVelocity.set(
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 14
    );

    // Sound effect: comical slide whistle descent
    if (window.soundController) {
      window.soundController.playFall();
    }

    // Register score & check level up
    this.totalKills++;
    this.killsThisLevel++;

    // Track the combo window for consecutive kills.
    const now = performance.now();
    if (now - this.comboTimer < 2500) {
      this.combo++;
    } else {
      this.combo = 1;
    }
    this.comboTimer = now;

    const speedTier = Math.max(
      0,
      Math.round((zombie.speed - this.baseSpeed) / LEVEL_SPEED_INCREASE)
    );
    const pointsEarned = Math.min(
      MAX_ZOMBIE_SCORE,
      BASE_ZOMBIE_SCORE + speedTier * SCORE_PER_SPEED_TIER
    );
    const texts = [
      `+${pointsEarned}! UÇTU! 🚀`,
      `+${pointsEarned}! GÜM! 💥`,
      `+${pointsEarned}! DÜŞTÜ! 🌪️`
    ];
    const txt = texts[Math.floor(Math.random() * texts.length)];
    this.createFloatingText(hitPoint, txt);

    this.addScore(pointsEarned);
    // Level progression: Advance slower so the campaign feels more controlled.
    if (this.killsThisLevel >= 2) {
      this.levelUp();
    }
  }

  // Level Up progression
  levelUp() {
    this.level++;
    this.killsThisLevel = 0;

    // Weapon upgrades on every level
    this.weaponLevel = this.level;
    this.weaponDamage = Math.min(5, 1 + (this.level - 1) * 0.5);
    this.shootCooldown = Math.max(90, 280 - (this.level - 1) * 18);
    this.projectileSpeed = 24 + (this.level - 1) * 2;

    // Increase zombie advance speed and spawn rate
    this.currentSpeed = this.baseSpeed + (this.level - 1) * LEVEL_SPEED_INCREASE;
    this.spawnInterval = Math.max(800, 2800 - (this.level - 1) * 240);
    this.maxActiveZombies = Math.min(6, 2 + Math.floor(this.level / 2));

    // Update palette theme for platform
    this.updatePlatformTheme();

    if (window.soundController) {
      window.soundController.playLevelUp();
    }

    this.showAnnouncement(`SEVİYE ${this.level}!`);
    this.showWeaponUpgrade();
    this.createFloatingText(new THREE.Vector3(0, 2.5, 0), `ATIŞ HIZI +${this.level - 1} ⚡`, 'bonus');
    this.updateHUD();
  }

  updatePlatformTheme() {
    const palette = LEVEL_PALETTES[(this.level - 1) % LEVEL_PALETTES.length];

    this.tiles.forEach(({ mesh, col, row, mat, wireMat }) => {
      const isChecker = (col + row) % 2 === 0;
      mat.color.setHex(isChecker ? palette.tileColor : new THREE.Color(palette.tileColor).multiplyScalar(1.3).getHex());
      mat.emissive.setHex(palette.edgeColor);
      wireMat.color.setHex(palette.edgeColor);
      wireMat.opacity = 0;
      wireMat.visible = false;
      if (mesh.children[0]) mesh.children[0].visible = false;
    });

    if (this.rimMat) {
      this.rimMat.color.setHex(palette.accent);
      this.rimMat.opacity = 0;
      this.rimMat.visible = false;
    }

    if (this.neonLight1) this.neonLight1.color.setHex(palette.edgeColor);
    if (this.neonLight2) this.neonLight2.color.setHex(palette.accent);
  }

  // Zombie missed by player (escaped past Row 4)
  onZombieMissed(zombie) {
    this.missedZombies++;

    if (window.soundController) {
      window.soundController.playMiss();
    }

    this.flashDamage();
    this.createFloatingText(
      zombie.mesh.position,
      `ZOMBİ KAÇTI! (${this.missedZombies}/${this.MAX_MISSES})`,
      "danger"
    );

    this.updateHUD();

    // Check Game Over condition: 5 missed zombies
    if (this.missedZombies >= this.MAX_MISSES) {
      this.gameOver();
    }
  }

  // Particle Explosions
  createExplosion(pos, colorHex = 0xff007f, count = 12) {
    const pGeo = new THREE.SphereGeometry(0.12, 6, 6);
    const pMat = new THREE.MeshBasicMaterial({ color: colorHex });

    for (let i = 0; i < count; i++) {
      const p = new THREE.Mesh(pGeo, pMat);
      p.position.copy(pos);
      this.scene.add(p);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        Math.random() * 6 + 1,
        (Math.random() - 0.5) * 8
      );

      this.particles.push({
        mesh: p,
        velocity: vel,
        gravity: 12,
        lifetime: 0.6 + Math.random() * 0.4,
        age: 0
      });
    }
  }

  // Floating HTML score/notification labels
  createFloatingText(worldPos, text, cssClass = '') {
    if (!this.camera) return;

    // Project world pos to screen pos
    const v = worldPos.clone();
    v.project(this.camera);

    const x = ((v.x + 1) * window.innerWidth) / 2;
    const y = ((-v.y + 1) * window.innerHeight) / 2;

    const el = document.createElement('div');
    el.className = `floating-text ${cssClass}`;
    el.innerText = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    this.floatingTextContainer.appendChild(el);

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 1100);
  }

  showAnnouncement(text) {
    this.announcementEl.innerText = text;
    this.announcementEl.classList.add('show');
    setTimeout(() => {
      this.announcementEl.classList.remove('show');
    }, 1500);
  }

  showWeaponUpgrade() {
    this.weaponUpgradeEl.innerText = 'SİLAH GÜÇLENDİ! ⚡';
    this.weaponUpgradeEl.classList.add('show');
    setTimeout(() => {
      this.weaponUpgradeEl.classList.remove('show');
    }, 2500);
  }

  flashDamage() {
    this.screenFlashEl.classList.add('damage');
    setTimeout(() => {
      this.screenFlashEl.classList.remove('damage');
    }, 250);
  }

  addScore(pts) {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('zombie_platform_highscore', this.highScore);
    }
    this.updateHUD();
  }

  updateHUD() {
    if (this.scoreEl) this.scoreEl.innerText = this.score;
    if (this.highScoreEl) this.highScoreEl.innerText = this.highScore;
    if (this.levelEl) this.levelEl.innerText = `SEVİYE ${this.level}`;

    // Render Hearts
    if (this.heartsEl) {
      this.heartsEl.innerHTML = '';
      for (let i = 0; i < this.MAX_MISSES; i++) {
        const slot = document.createElement('div');
        slot.className = 'heart-slot';
        if (i < this.missedZombies) {
          slot.classList.add('lost');
          slot.innerText = '💀';
        } else {
          slot.innerText = '💚';
        }
        this.heartsEl.appendChild(slot);
      }
    }
  }

  // --- GAME STATE TRANSITIONS ---
  startGame() {
    this.score = 0;
    this.level = 1;
    this.killsThisLevel = 0;
    this.totalKills = 0;
    this.missedZombies = 0;
    this.currentSpeed = this.baseSpeed;
    this.spawnInterval = 2800;
    this.lastSpawnTime = performance.now();
    this.combo = 0;
    this.weaponLevel = 1;
    this.weaponDamage = 1;
    this.projectileSpeed = 24;
    this.shootCooldown = 280;

    // Clear existing zombies and projectiles
    this.zombies.forEach(z => this.scene.remove(z.mesh));
    this.zombies = [];
    this.projectiles.forEach(p => this.scene.remove(p.mesh));
    this.projectiles = [];
    this.particles.forEach(p => this.scene.remove(p.mesh));
    this.particles = [];

    // Reset player position
    this.playerCol = 2;
    const { x, z } = this.gridToWorld(2, GRID_ROWS - 1);
    this.playerGroup.position.set(x, 0, z + 0.3);
    this.playerX = x;
    this.targetPlayerX = x;

    this.updatePlatformTheme();
    this.updateHUD();

    this.startModal.classList.remove('active');
    this.gameoverModal.classList.remove('active');
    this.pauseModal.classList.remove('active');

    this.state = 'PLAYING';

    if (window.soundController) {
      window.soundController.ensureContext();
      window.soundController.startBgm();
    }

    // Spawn first zombie immediately
    this.createZombie(2);
  }

  gameOver() {
    this.state = 'GAMEOVER';

    if (window.soundController) {
      window.soundController.stopBgm();
      window.soundController.playGameOver();
    }

    document.getElementById('final-score').innerText = this.score;
    document.getElementById('final-kills').innerText = this.totalKills;
    document.getElementById('final-level').innerText = this.level;
    document.getElementById('modal-high-score').innerText = this.highScore;

    this.gameoverModal.classList.add('active');
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      this.pauseModal.classList.add('active');
      if (window.soundController) window.soundController.stopBgm();
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      this.pauseModal.classList.remove('active');
      if (window.soundController) window.soundController.startBgm();
    }
  }

  // --- INPUT & EVENT BINDINGS ---
  bindEvents() {
    // Window Resize
    window.addEventListener('resize', () => {
      if (!this.camera || !this.renderer) return;
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Mouse Move & Raycast targeting
    window.addEventListener('pointermove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.updateAiming();
    });

    // Left Click: Shoot at crosshair / targeted cell or zombie
    window.addEventListener('pointerdown', (e) => {
      // Don't fire if clicking interactive UI buttons
      if (e.target.closest('.btn-action') || e.target.closest('.btn-icon') || e.target.closest('.modal-card')) {
        return;
      }
      if (this.state === 'PLAYING') {
        let aimTarget = this.crosshairMesh.position.clone();
        if (this.camera && this.zombies.length > 0) {
          const activeMeshes = this.zombies.filter(z => z.state === 'WALKING').map(z => z.mesh);
          const hits = this.raycaster.intersectObjects(activeMeshes, true);
          if (hits.length > 0) {
            aimTarget = hits[0].point.clone();
          }
        }
        this.shootAt(aimTarget);
      }
    });

    // Keyboard Controls
    window.addEventListener('keydown', (e) => {
      if ((this.state === 'START' || this.state === 'GAMEOVER') && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        this.startGame();
        return;
      }

      if (this.state === 'PLAYING') {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          this.movePlayerColumn(-1);
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          this.movePlayerColumn(1);
        } else if (e.code === 'Space') {
          e.preventDefault();
          // Fire straight down current column
          const { x } = this.gridToWorld(this.playerCol, 0);
          this.shootAt(new THREE.Vector3(x, 0.5, -HALF_GRID_Z));
        } else if (e.code === 'KeyP' || e.code === 'Escape') {
          this.togglePause();
        } else if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].includes(e.code)) {
          const colIndex = parseInt(e.code.replace('Digit', ''), 10) - 1;
          this.setPlayerColumn(colIndex);
          const { x } = this.gridToWorld(colIndex, 0);
          this.shootAt(new THREE.Vector3(x, 0.5, -HALF_GRID_Z));
        }
      }
    });

    // UI Buttons
    document.getElementById('btn-start').addEventListener('click', () => this.startGame());
    document.getElementById('btn-restart').addEventListener('click', () => this.startGame());
    document.getElementById('btn-resume').addEventListener('click', () => this.togglePause());

    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) pauseBtn.addEventListener('click', () => this.togglePause());

    const soundBtn = document.getElementById('btn-sound');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        if (window.soundController) {
          const isMuted = window.soundController.toggleMute();
          soundBtn.innerText = isMuted ? '🔇' : '🔊';
        }
      });
    }

    // Mobile on-screen controls
    const mLeft = document.getElementById('btn-mobile-left');
    const mRight = document.getElementById('btn-mobile-right');
    const mShoot = document.getElementById('btn-mobile-shoot');

    if (mLeft) mLeft.addEventListener('click', () => this.movePlayerColumn(-1));
    if (mRight) mRight.addEventListener('click', () => this.movePlayerColumn(1));
    if (mShoot) mShoot.addEventListener('click', () => {
      const { x } = this.gridToWorld(this.playerCol, 0);
      this.shootAt(new THREE.Vector3(x, 0.5, -HALF_GRID_Z));
    });
  }

  movePlayerColumn(delta) {
    this.setPlayerColumn(this.playerCol + delta);
  }

  setPlayerColumn(col) {
    this.playerCol = Math.max(0, Math.min(GRID_COLS - 1, col));
    const { x } = this.gridToWorld(this.playerCol, 4);
    this.targetPlayerX = x;
  }

  updateAiming() {
    if (!this.camera || !this.crosshairMesh) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Plane at Y = 0 (surface of platform)
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectPoint = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(groundPlane, intersectPoint);

    if (hit) {
      // Clamp crosshair to within platform bounds + margin
      const clampedX = Math.max(-PLATFORM_HALF_WIDTH, Math.min(PLATFORM_HALF_WIDTH, intersectPoint.x));
      const clampedZ = Math.max(-PLATFORM_HALF_DEPTH, Math.min(PLATFORM_HALF_DEPTH, intersectPoint.z));
      this.crosshairMesh.position.set(clampedX, 0.05, clampedZ);

      // Rotate player cannon towards crosshair
      if (this.cannonHead && this.playerGroup) {
        const angle = Math.atan2(clampedX - this.playerGroup.position.x, clampedZ - this.playerGroup.position.z);
        this.cannonHead.rotation.y = angle - Math.PI;
      }
    }
  }

  initHUD() {
    this.updateHUD();
  }

  // --- MAIN GAME LOOP ---
  loop(timestamp) {
    requestAnimationFrame((t) => this.loop(t));

    const dt = Math.min((timestamp - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = timestamp;

    if (this.state === 'PLAYING') {
      this.updateGame(dt, timestamp);
    }

    this.updateDecor(dt, timestamp);
    this.updateCamera();

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  updateGame(dt, timestamp) {
    // Smooth player lateral movement
    this.playerX += (this.targetPlayerX - this.playerX) * (15 * dt);
    this.playerGroup.position.x = this.playerX;

    // Zombie Spawning
    if (timestamp - this.lastSpawnTime > this.spawnInterval) {
      this.lastSpawnTime = timestamp;
      if (this.zombies.filter(z => z.state === 'WALKING').length < this.maxActiveZombies) {
        // Spawn in random column
        this.createZombie();
      }
    }

    // Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.mesh.position.addScaledVector(p.velocity, dt);

      // Check collision with walking zombies
      let hitZombie = false;
      for (const z of this.zombies) {
        if (z.state === 'WALKING') {
          const zPos = z.mesh.position;
          const dx = Math.abs(p.mesh.position.x - zPos.x);
          const dz = Math.abs(p.mesh.position.z - zPos.z);
          const dy = p.mesh.position.y - zPos.y;

          // Box hitbox: generous 1.1x1.1 width/depth and full zombie height
          if (dx < 1.1 && dz < 1.1 && dy >= -0.2 && dy <= 2.2) {
            this.hitZombie(z, p.mesh.position.clone(), p.velocity, p.damage);
            hitZombie = true;
            break;
          }
        }
      }

      // Check bounds or lifetime
      if (hitZombie || p.mesh.position.z < -20 || p.mesh.position.y < -5 || p.mesh.position.length() > 40) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    // Update Zombies
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];

      if (z.state === 'WALKING') {
        // Walk straight forward along Z axis (towards Row 4)
        z.mesh.position.z += z.speed * dt;
        z.walkCycle += dt * 8 * (z.speed / this.baseSpeed);

        // Walking wobble animation
        if (z.legL && z.legR) {
          z.legL.rotation.x = Math.sin(z.walkCycle) * 0.6;
          z.legR.rotation.x = -Math.sin(z.walkCycle) * 0.6;
        }
        if (z.armL && z.armR) {
          z.armL.rotation.x = Math.sin(z.walkCycle) * 0.3;
          z.armR.rotation.x = -Math.sin(z.walkCycle) * 0.3;
        }
        if (z.head) {
          z.head.rotation.y = Math.sin(z.walkCycle * 0.5) * 0.2;
          z.head.rotation.z = Math.sin(z.walkCycle * 0.5) * 0.08;
        }

        // Did zombie pass Row 4 (front edge of the 5x5 platform)?
        if (z.mesh.position.z > HALF_GRID_Z + 1.2) {
          this.onZombieMissed(z);
          // Let it plummet off the front edge
          z.state = 'FALLING';
          z.velocity.set(0, -3, 3);
        }

      } else if (z.state === 'KNOCKED_OFF' || z.state === 'FALLING') {
        // Physics knockback: Apply gravity and tumble off the platform into the abyss!
        z.velocity.y -= 22 * dt; // Gravity
        z.mesh.position.addScaledVector(z.velocity, dt);

        // If falling near or below platform surface while still within bounds, push off nearest edge
        if (z.mesh.position.y < 0.2 && Math.abs(z.mesh.position.x) < PLATFORM_HALF_WIDTH && Math.abs(z.mesh.position.z) < PLATFORM_HALF_DEPTH) {
          const pushDirX = z.mesh.position.x >= 0 ? 1 : -1;
          z.velocity.x += pushDirX * 18 * dt;
          z.velocity.z -= 18 * dt;
        }

        z.mesh.rotation.x += z.rotVelocity.x * dt;
        z.mesh.rotation.y += z.rotVelocity.y * dt;
        z.mesh.rotation.z += z.rotVelocity.z * dt;

        // When fallen deep into the abyss, remove zombie
        if (z.mesh.position.y < -18) {
          this.scene.remove(z.mesh);
          this.zombies.splice(i, 1);
          // Respawn a new zombie after a short delay!
          setTimeout(() => {
            if (this.state === 'PLAYING') {
              this.createZombie();
            }
          }, Math.max(500, this.spawnInterval * 0.6));
        }
      }
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.age += dt;
      pt.velocity.y -= pt.gravity * dt;
      pt.mesh.position.addScaledVector(pt.velocity, dt);

      const lifeRatio = 1 - (pt.age / pt.lifetime);
      pt.mesh.scale.setScalar(Math.max(0.01, lifeRatio));

      if (pt.age >= pt.lifetime) {
        this.scene.remove(pt.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  updateDecor(dt, timestamp) {
    // Gentle floating animation of platform & ambient crystals
    const timeSec = timestamp * 0.001;

    if (this.floatingDecors) {
      this.floatingDecors.forEach((dec) => {
        dec.mesh.rotation.x += dec.rotSpeed;
        dec.mesh.rotation.y += dec.rotSpeed * 1.5;
        dec.mesh.position.y = dec.baseY + Math.sin(timeSec * dec.bobSpeed + dec.bobOffset) * 0.6;
      });
    }

    // Crosshair pulse
    if (this.crosshairMesh) {
      const s = 1.0 + Math.sin(timeSec * 6) * 0.08;
      this.crosshairMesh.scale.set(s, s, s);
    }
  }

  updateCamera() {
    this.camera.position.copy(this.cameraDefaultPos);
  }
}

// Instantiate game on load
window.addEventListener('DOMContentLoaded', () => {
  window.game = new ZombieGame();
});
