import { Container, Graphics, Text } from 'pixi.js';
import { TILE_SIZE } from './constants';
import { isWalkable } from './terrain';
import type { Survivor } from './survivor';
import type { POIManager } from './poi';
import type { BuildingManager } from './building';

// Interface so survivor.ts can interact with threats without circular imports
export interface ThreatInfo {
  nearestEnemy(fromX: number, fromY: number, radius: number): Enemy | null;
  attackEnemy(enemy: Enemy, damage: number): void;
}

export type EnemyType = 'raider' | 'feral_dog';

interface EnemyDef {
  label: string;
  maxHp: number;
  damage: number;
  attackInterval: number;
  moveInterval: number;
  color: number;
  size: number;
  countRange: [number, number]; // min, max per raid wave
}

const ENEMY_DEFS: Record<EnemyType, EnemyDef> = {
  raider: {
    label: 'Raider', maxHp: 60, damage: 8,
    attackInterval: 6, moveInterval: 8,
    color: 0xc04040, size: 0.35, countRange: [2, 5],
  },
  feral_dog: {
    label: 'Feral Dog', maxHp: 30, damage: 5,
    attackInterval: 4, moveInterval: 5,
    color: 0x6a4030, size: 0.28, countRange: [3, 6],
  },
};

export class Enemy {
  readonly type: EnemyType;
  readonly def: EnemyDef;
  tileX: number;
  tileY: number;
  hp: number;
  readonly maxHp: number;

  private moveTimer = 0;
  private attackTimer = 0;
  private targetX: number;
  private targetY: number;
  private pixelX: number;
  private pixelY: number;

  readonly container = new Container();
  private sprite: Graphics;
  private hpBarGfx: Graphics;

  constructor(type: EnemyType, x: number, y: number) {
    this.type = type;
    this.def = ENEMY_DEFS[type];
    this.tileX = x;
    this.tileY = y;
    this.targetX = x;
    this.targetY = y;
    this.hp = this.def.maxHp;
    this.maxHp = this.def.maxHp;
    this.pixelX = x * TILE_SIZE + TILE_SIZE / 2;
    this.pixelY = y * TILE_SIZE + TILE_SIZE / 2;

    this.sprite = new Graphics();
    this.sprite.circle(0, 0, TILE_SIZE * this.def.size).fill(this.def.color);
    this.sprite.circle(0, 0, TILE_SIZE * this.def.size).stroke({ color: 0xff4040, width: 2 });
    this.container.addChild(this.sprite);

    const label = new Text({
      text: this.def.label,
      style: { fontSize: 9, fill: 0xff6060, fontFamily: 'Courier New' },
    });
    label.anchor.set(0.5, 1);
    label.y = -TILE_SIZE * 0.4;
    this.container.addChild(label);

    this.hpBarGfx = new Graphics();
    this.container.addChild(this.hpBarGfx);

    this.updatePosition();
    this.updateHpBar();
  }

  get isDead(): boolean {
    return this.hp <= 0;
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
    this.updateHpBar();
  }

  tick(survivors: Survivor[], poiManager: POIManager, buildings: BuildingManager): void {
    if (this.isDead) return;

    // Find nearest alive survivor
    let nearest: Survivor | null = null;
    let nearestDist = Infinity;
    for (const s of survivors) {
      if (s.state === 'dead') continue;
      const dx = s.tileX - this.tileX;
      const dy = s.tileY - this.tileY;
      const dist = dx * dx + dy * dy;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = s;
      }
    }
    if (!nearest) return;

    // Attack if adjacent (within sqrt(2) tiles)
    if (nearestDist <= 2) {
      this.attackTimer++;
      if (this.attackTimer >= this.def.attackInterval) {
        this.attackTimer = 0;
        const reduction = nearest.stats.resilience * 0.5;
        const dmg = Math.max(1, this.def.damage - reduction);
        nearest.takeDamage(dmg);
      }
    }

    // Move toward nearest survivor
    this.moveTimer++;
    if (this.moveTimer >= this.def.moveInterval) {
      this.moveTimer = 0;
      if (nearestDist > 2) {
        this.moveToward(nearest.tileX, nearest.tileY, poiManager, buildings);
      }
    }
  }

  private moveToward(goalX: number, goalY: number, poiManager: POIManager, buildings: BuildingManager): void {
    const dx = Math.sign(goalX - this.tileX);
    const dy = Math.sign(goalY - this.tileY);

    const candidates = [
      [dx, dy], [dx, 0], [0, dy],
    ].filter(([cx, cy]) => cx !== 0 || cy !== 0);

    for (const [cx, cy] of candidates) {
      const nx = this.tileX + cx!;
      const ny = this.tileY + cy!;
      if (isWalkable(nx, ny) && !poiManager.isWall(nx, ny) && !buildings.blocksMovement(nx, ny)) {
        this.targetX = nx;
        this.targetY = ny;
        return;
      }
    }
  }

  updateVisuals(): void {
    if (this.isDead) return;
    const goalX = this.targetX * TILE_SIZE + TILE_SIZE / 2;
    const goalY = this.targetY * TILE_SIZE + TILE_SIZE / 2;
    const dx = goalX - this.pixelX;
    const dy = goalY - this.pixelY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 1) {
      const step = Math.min(2, dist);
      this.pixelX += (dx / dist) * step;
      this.pixelY += (dy / dist) * step;
    } else {
      this.pixelX = goalX;
      this.pixelY = goalY;
      this.tileX = this.targetX;
      this.tileY = this.targetY;
    }
    this.updatePosition();
  }

  private updatePosition(): void {
    this.container.x = this.pixelX;
    this.container.y = this.pixelY;
  }

  private updateHpBar(): void {
    this.hpBarGfx.clear();
    const barW = 20;
    const barH = 3;
    const y = -TILE_SIZE * 0.3;
    this.hpBarGfx.rect(-barW / 2, y, barW, barH).fill({ color: 0x000000, alpha: 0.5 });
    const fillW = (this.hp / this.maxHp) * barW;
    if (fillW > 0) {
      this.hpBarGfx.rect(-barW / 2, y, fillW, barH).fill(0xc04040);
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}

export class ThreatManager implements ThreatInfo {
  readonly enemies: Enemy[] = [];
  readonly container = new Container();

  // Raid scheduling
  private raidTimer = 0;
  private nextRaidTick: number;
  private warningTicks = 0;
  private readonly RAID_WARNING_DURATION = 40;

  raidIncoming = false;
  raidActive = false;

  constructor() {
    this.nextRaidTick = 400 + Math.floor(Math.random() * 300);
  }

  get raidStatus(): string | null {
    if (this.raidIncoming) {
      const remaining = this.RAID_WARNING_DURATION - this.warningTicks;
      return `Raid incoming! (${remaining})`;
    }
    if (this.raidActive) return `Under attack! (${this.enemies.length} hostiles)`;
    return null;
  }

  tick(
    survivors: Survivor[],
    dayCount: number,
    poiManager: POIManager,
    buildings: BuildingManager,
  ): void {
    const alive = survivors.filter((s) => s.state === 'alive');
    if (alive.length === 0) return;

    // Raid scheduling
    this.raidTimer++;

    if (!this.raidIncoming && !this.raidActive && this.raidTimer >= this.nextRaidTick) {
      this.raidIncoming = true;
      this.warningTicks = 0;
    }

    if (this.raidIncoming) {
      this.warningTicks++;
      if (this.warningTicks >= this.RAID_WARNING_DURATION) {
        this.raidIncoming = false;
        this.raidActive = true;
        this.spawnRaid(alive, dayCount);
      }
    }

    // Tick enemies
    for (const enemy of this.enemies) {
      enemy.tick(survivors, poiManager, buildings);
    }

    // Remove dead enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (this.enemies[i]!.isDead) {
        const enemy = this.enemies[i]!;
        this.container.removeChild(enemy.container);
        enemy.destroy();
        this.enemies.splice(i, 1);
      }
    }

    // Check if raid is over
    if (this.raidActive && this.enemies.length === 0) {
      this.raidActive = false;
      this.raidTimer = 0;
      const base = Math.max(300, 800 - dayCount * 15);
      this.nextRaidTick = base + Math.floor(Math.random() * 300);
    }
  }

  private spawnRaid(alive: Survivor[], dayCount: number): void {
    const avgX = Math.round(alive.reduce((s, sv) => s + sv.tileX, 0) / alive.length);
    const avgY = Math.round(alive.reduce((s, sv) => s + sv.tileY, 0) / alive.length);

    const angle = Math.random() * Math.PI * 2;
    const spawnDist = 25 + Math.floor(Math.random() * 15);
    const spawnX = avgX + Math.round(Math.cos(angle) * spawnDist);
    const spawnY = avgY + Math.round(Math.sin(angle) * spawnDist);

    const type: EnemyType = Math.random() < 0.6 ? 'raider' : 'feral_dog';
    const def = ENEMY_DEFS[type];
    const difficulty = Math.min(def.countRange[1], def.countRange[0] + Math.floor(dayCount / 4));

    for (let i = 0; i < difficulty; i++) {
      const ex = spawnX + Math.floor(Math.random() * 5) - 2;
      const ey = spawnY + Math.floor(Math.random() * 5) - 2;
      const enemy = new Enemy(type, Math.max(0, ex), Math.max(0, ey));
      this.enemies.push(enemy);
      this.container.addChild(enemy.container);
    }
  }

  nearestEnemy(fromX: number, fromY: number, radius: number): Enemy | null {
    let best: Enemy | null = null;
    let bestDist = radius * radius;
    for (const e of this.enemies) {
      if (e.isDead) continue;
      const dx = e.tileX - fromX;
      const dy = e.tileY - fromY;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = e;
      }
    }
    return best;
  }

  attackEnemy(enemy: Enemy, damage: number): void {
    enemy.takeDamage(damage);
  }

  enemyAt(x: number, y: number): Enemy | undefined {
    return this.enemies.find((e) => !e.isDead && e.tileX === x && e.tileY === y);
  }

  updateVisuals(): void {
    for (const e of this.enemies) {
      e.updateVisuals();
    }
  }
}
