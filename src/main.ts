import { Application, Container, Graphics } from 'pixi.js';
import { TICKS_PER_SECOND_BASE } from './constants';
import { ChunkManager } from './chunk';
import { Camera } from './camera';
import { Survivor } from './survivor';
import { GameState, TimeSpeed } from './gamestate';
import { ResourceManager } from './resources';
import { Stockpile } from './stockpile';
import { POIManager } from './poi';
import { BuildingManager } from './building';
import { UI } from './ui';
import { BACKGROUNDS } from './types';
import { SocialManager } from './social';
import { ThreatManager } from './combat';
import { saveGame, loadGame, hasSave, type SaveData } from './save';

const RESOURCE_RESPAWN_TICKS = 80;
const RECRUITMENT_INTERVAL_TICKS = 600; // ~every 2.5 in-game days at 1x

// Survivor start position (center-ish of the map)
const START_X = 2048;
const START_Y = 2048;

function restoreFromSave(
  data: SaveData,
  gameState: GameState,
  survivors: Survivor[],
  stockpile: Stockpile,
  world: Container,
): void {
  gameState.loadFrom(data.gameState);

  for (const sd of data.survivors) {
    const bgTitle = sd['backgroundTitle'] as string | undefined;
    const bg = BACKGROUNDS.find((b) => b.title === bgTitle);
    const tx = (sd['tileX'] as number) ?? START_X;
    const ty = (sd['tileY'] as number) ?? START_Y;
    const s = new Survivor(tx, ty, bg);
    s.loadFrom(sd);
    survivors.push(s);
    world.addChild(s.container);
  }

  if (data.stockpile) {
    for (const tile of data.stockpile.tiles) {
      stockpile.addTile(tile.x, tile.y);
    }
  }
}

async function boot() {
  const app = new Application();
  await app.init({
    resizeTo: window,
    backgroundColor: 0x1a1a1a,
    antialias: false,
  });
  document.getElementById('game-container')!.appendChild(app.canvas);

  const world = new Container();
  app.stage.addChild(world);

  // Night overlay — fixed to viewport, not in world container
  const nightOverlay = new Graphics();
  nightOverlay.rect(0, 0, window.innerWidth, window.innerHeight).fill(0x101828);
  nightOverlay.alpha = 0;
  nightOverlay.eventMode = 'none';
  app.stage.addChild(nightOverlay);

  // Resize night overlay with window
  window.addEventListener('resize', () => {
    nightOverlay.clear();
    nightOverlay.rect(0, 0, window.innerWidth, window.innerHeight).fill(0x101828);
  });

  // Chunk-based terrain rendering
  const chunkManager = new ChunkManager(world, app);

  // POIs (deterministic per-region)
  const poiManager = new POIManager(world);

  // Stockpile
  const stockpile = new Stockpile();
  world.addChild(stockpile.container);

  // Buildings
  const buildings = new BuildingManager();
  world.addChild(buildings.container);

  // Resources (per-chunk)
  const resources = new ResourceManager();
  world.addChild(resources.container);

  // Social
  const social = new SocialManager();

  // Threats
  const threats = new ThreatManager();
  world.addChild(threats.container);

  // Survivors — start with 3, each with a different background
  const survivors: Survivor[] = [];
  function createSurvivor(x: number, y: number, bg?: typeof BACKGROUNDS[number]): Survivor {
    const s = new Survivor(x, y, bg);
    survivors.push(s);
    world.addChild(s.container);
    return s;
  }

  const gameState = new GameState();

  // Check for saved game and restore
  const savedData = loadGame();
  if (savedData) {
    restoreFromSave(savedData, gameState, survivors, stockpile, world);
  } else {
    createSurvivor(START_X, START_Y, BACKGROUNDS[0]);      // Park Ranger
    createSurvivor(START_X + 2, START_Y, BACKGROUNDS[2]);   // Mechanic
    createSurvivor(START_X, START_Y + 2, BACKGROUNDS[4]);   // Chef
  }

  // Camera — center on first alive survivor or start position
  const camera = new Camera(app.canvas as HTMLCanvasElement);
  const firstAlive = survivors.find((s) => s.state === 'alive');
  camera.centerOn(firstAlive?.tileX ?? START_X, firstAlive?.tileY ?? START_Y);

  const ui = new UI();

  // UI wiring
  ui.bindSpeedButtons((speed: TimeSpeed) => {
    gameState.speed = speed;
  });

  ui.bindSaveLoad(
    () => saveGame(gameState, survivors, stockpile),
    () => {
      if (!hasSave()) return;
      // Save is already in localStorage — just reload to restore it
      location.reload();
    },
  );

  ui.bindRestart(() => {
    // Clear save so we get a fresh start
    localStorage.removeItem('ashfall_save');
    location.reload();
  });

  // Survivor list click handler
  ui.onSurvivorSelect = (survivor: Survivor) => {
    selected = { type: 'survivor', entity: survivor };
    ui.showSurvivor(survivor, social, survivors);
    camera.centerOn(survivor.tileX, survivor.tileY);
  };

  // Click handling
  let selected: { type: 'survivor'; entity: Survivor }
    | { type: 'poi'; entity: ReturnType<typeof poiManager.poiAt> }
    | { type: 'stockpile' }
    | { type: 'structure'; entity: ReturnType<typeof buildings.structureAt> }
    | { type: 'enemy'; entity: ReturnType<typeof threats.enemyAt> }
    | null = null;

  app.canvas.addEventListener('click', (e: MouseEvent) => {
    const { tx, ty } = camera.screenToTile(e.clientX, e.clientY);

    // Stockpile mode
    if (ui.interactionMode === 'stockpile') {
      const terrain = chunkManager.getTerrainAt(tx, ty);
      if (terrain && !poiManager.isWall(tx, ty) && !buildings.blocksMovement(tx, ty)) {
        if (stockpile.hasTile(tx, ty)) {
          stockpile.removeTile(tx, ty);
        } else {
          stockpile.addTile(tx, ty);
        }
      }
      return;
    }

    // Build mode
    if (ui.interactionMode === 'build' && ui.selectedBuildType) {
      if (buildings.canPlace(tx, ty) && !poiManager.isWall(tx, ty) && !stockpile.hasTile(tx, ty)) {
        buildings.placeBlueprint(ui.selectedBuildType, tx, ty);
      }
      return;
    }

    // Select mode
    const clickedSurvivor = survivors.find((s) => s.tileX === tx && s.tileY === ty);
    if (clickedSurvivor) {
      selected = { type: 'survivor', entity: clickedSurvivor };
      ui.showSurvivor(clickedSurvivor, social, survivors);
      return;
    }

    const clickedEnemy = threats.enemyAt(tx, ty);
    if (clickedEnemy) {
      selected = { type: 'enemy', entity: clickedEnemy };
      ui.showEnemy(clickedEnemy);
      return;
    }

    const clickedStructure = buildings.structureAt(tx, ty);
    if (clickedStructure) {
      selected = { type: 'structure', entity: clickedStructure };
      ui.showStructure(clickedStructure);
      return;
    }

    if (stockpile.hasTile(tx, ty)) {
      selected = { type: 'stockpile' };
      ui.showStockpileInfo(stockpile);
      return;
    }

    poiManager.ensureAround(tx, ty, 1);
    const clickedPOI = poiManager.poiAt(tx, ty);
    if (clickedPOI) {
      selected = { type: 'poi', entity: clickedPOI };
      ui.showPOI(clickedPOI);
      return;
    }

    selected = null;
    ui.hidePanel();
  });

  // Game loop
  let tickAccumulator = 0;
  let respawnCounter = 0;
  let recruitCounter = 0;
  let gameOver = false;
  const deadSet = new Set<Survivor>(survivors.filter((s) => s.state === 'dead'));

  app.ticker.add((ticker) => {
    if (gameOver) return;
    const delta = ticker.deltaTime;

    camera.update();
    camera.apply(world);

    // Update chunk visibility
    chunkManager.update(camera);
    poiManager.updateVisibility(camera);
    resources.updateVisibility(camera);

    // Simulation ticks
    if (gameState.speed > 0) {
      const ticksPerFrame = (TICKS_PER_SECOND_BASE * gameState.speed * delta) / 60;
      tickAccumulator += ticksPerFrame;

      while (tickAccumulator >= 1) {
        tickAccumulator -= 1;
        gameState.tick();

        for (const s of survivors) {
          s.tick(resources, stockpile, poiManager, buildings, gameState.isNight, threats);
        }

        // Social interactions
        social.tick(survivors);

        // Threat/combat system
        threats.tick(survivors, gameState.day, poiManager, buildings);

        // Check for new deaths and notify survivors
        for (const s of survivors) {
          if (s.state === 'dead' && !deadSet.has(s)) {
            deadSet.add(s);
            for (const other of survivors) {
              if (other !== s && other.state === 'alive') {
                other.onAllyDeath();
              }
            }
          }
        }

        // Recruitment events
        recruitCounter++;
        if (recruitCounter >= RECRUITMENT_INTERVAL_TICKS) {
          recruitCounter = 0;
          const aliveCount = survivors.filter((s) => s.state === 'alive').length;
          // 30% chance per interval, higher if colony is small
          const chance = aliveCount <= 2 ? 0.5 : 0.3;
          if (Math.random() < chance && aliveCount > 0) {
            // Find the average position of alive survivors
            const alive = survivors.filter((s) => s.state === 'alive');
            const avgX = Math.round(alive.reduce((sum, s) => sum + s.tileX, 0) / alive.length);
            const avgY = Math.round(alive.reduce((sum, s) => sum + s.tileY, 0) / alive.length);
            // Spawn nearby (10-20 tiles away)
            const angle = Math.random() * Math.PI * 2;
            const dist = 10 + Math.floor(Math.random() * 10);
            const nx = avgX + Math.round(Math.cos(angle) * dist);
            const ny = avgY + Math.round(Math.sin(angle) * dist);
            createSurvivor(nx, ny);
          }
        }

        // Respawn resources near survivors
        respawnCounter++;
        if (respawnCounter >= RESOURCE_RESPAWN_TICKS) {
          respawnCounter = 0;
          for (const s of survivors) {
            if (s.state === 'alive') {
              const type = Math.random() < 0.5 ? 'food' as const : 'water' as const;
              resources.spawnNear(s.tileX, s.tileY, type);
            }
          }
        }
      }
    }

    // Visual updates
    for (const s of survivors) {
      s.updateVisuals(delta);
    }
    threats.updateVisuals();

    // Night overlay
    nightOverlay.alpha = 1 - gameState.daylight;

    // UI
    ui.update(gameState, stockpile);
    ui.updateRaidWarning(threats.raidStatus);
    ui.updateSurvivorList(survivors, selected?.type === 'survivor' ? selected.entity : null);
    ui.updateBuildMenu(buildings);
    if (selected) {
      if (selected.type === 'survivor') {
        ui.showSurvivor(selected.entity, social, survivors);
      } else if (selected.type === 'poi' && selected.entity) {
        ui.showPOI(selected.entity);
      } else if (selected.type === 'stockpile') {
        ui.showStockpileInfo(stockpile);
      } else if (selected.type === 'structure' && selected.entity) {
        ui.showStructure(selected.entity);
      } else if (selected.type === 'enemy' && selected.entity) {
        if (selected.entity.isDead) {
          selected = null;
          ui.hidePanel();
        } else {
          ui.showEnemy(selected.entity);
        }
      }
    }

    if (survivors.every((s) => s.state === 'dead')) {
      gameOver = true;
      gameState.speed = 0;
      ui.showDeath();
    }
  });
}

boot().catch(console.error);
