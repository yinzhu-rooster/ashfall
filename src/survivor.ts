import { Container, Graphics, Text } from 'pixi.js';
import { TILE_SIZE, SEARCH_RADIUS } from './constants';
import { Stats, Background, BACKGROUNDS, FIRST_NAMES, getNextSurvivorId, type WorkPriorities, DEFAULT_WORK_PRIORITIES } from './types';
import { isWalkable } from './terrain';
import { ResourceManager, ResourceType } from './resources';
import { Inventory, ItemCategory } from './items';
import { Stockpile } from './stockpile';
import { POI, POIManager } from './poi';
import { BuildingManager, Structure } from './building';
import type { ThreatInfo, Enemy } from './combat';

export type SurvivorState = 'alive' | 'dead';
type AIGoal =
  | 'wander'
  | 'seek_food'
  | 'seek_water'
  | 'rest'
  | 'seek_bed'
  | 'scavenge'
  | 'haul_to_stockpile'
  | 'build'
  | 'fight';

const NEED_MAX = 100;
const HUNGER_DECAY_PER_TICK = 0.15;
const THIRST_DECAY_PER_TICK = 0.2;
const REST_DECAY_PER_TICK = 0.08;
const REST_RECOVERY_PER_TICK = 0.6;
const NEED_SEEK_THRESHOLD = 40;
const NEED_URGENT_THRESHOLD = 20;
const SCAVENGE_TICKS = 12;
const MORALE_MAX = 100;
const MORALE_DECAY_PER_TICK = 0.02;
const MORALE_LOW_THRESHOLD = 25; // below this, work speed halved
const MORALE_BREAK_THRESHOLD = 10; // below this, mental break

// Track used names to avoid duplicates
const usedNames = new Set<string>();
export function resetUsedNames(): void {
  usedNames.clear();
}

function pickUniqueName(): string {
  // Try unused names first
  const available = FIRST_NAMES.filter((n) => !usedNames.has(n));
  if (available.length > 0) {
    const name = available[Math.floor(Math.random() * available.length)]!;
    usedNames.add(name);
    return name;
  }
  // All names used — append a number suffix
  let suffix = 2;
  const base = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]!;
  let candidate = `${base} ${suffix}`;
  while (usedNames.has(candidate)) {
    suffix++;
    candidate = `${base} ${suffix}`;
  }
  usedNames.add(candidate);
  return candidate;
}

export class Survivor {
  readonly id: number;
  readonly name: string;
  readonly background: Background;
  readonly stats: Stats;

  tileX: number;
  tileY: number;
  state: SurvivorState = 'alive';

  // Needs
  hunger = NEED_MAX;
  thirst = NEED_MAX;
  rest = NEED_MAX;
  morale = 70; // starts decent

  // Health
  hp: number;
  get maxHp(): number {
    return 50 + this.stats.strength * 3 + this.stats.resilience * 2;
  }
  get injured(): boolean {
    return this.hp < this.maxHp;
  }

  // Combat
  private combatTimer = 0;
  private fightTarget: Enemy | null = null;
  private readonly COMBAT_INTERVAL = 5;

  get combatDamage(): number {
    return 5 + Math.floor(this.stats.strength / 2);
  }

  // Mental break
  private mentalBreak = false;
  private mentalBreakTimer = 0;
  private readonly MENTAL_BREAK_DURATION = 30; // ticks

  // Work priorities (player-controlled)
  workPriorities: WorkPriorities = { ...DEFAULT_WORK_PRIORITIES };

  // Inventory
  readonly inventory: Inventory;

  // AI state
  private aiGoal: AIGoal = 'wander';
  private targetX: number;
  private targetY: number;
  private moveTimer = 0;
  private readonly MOVE_INTERVAL = 6;

  // Scavenging state
  private scavengeTarget: POI | null = null;
  private scavengeTimer = 0;
  private isScavenging = false;

  // Building state
  private buildTarget: Structure | null = null;
  private isBuilding = false;
  private buildTimer = 0;

  // Visual
  readonly container = new Container();
  private sprite: Graphics;
  private nameLabel: Text;
  private needsBars: Container;
  private pixelX: number;
  private pixelY: number;
  private readonly PIXEL_SPEED = 2;

  constructor(startX: number, startY: number, bg?: Background) {
    this.id = getNextSurvivorId();
    this.name = pickUniqueName();
    this.background = bg ?? BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)]!;

    this.stats = {
      strength: this.rollStat() + (this.background.statBonuses.strength ?? 0),
      intelligence: this.rollStat() + (this.background.statBonuses.intelligence ?? 0),
      dexterity: this.rollStat() + (this.background.statBonuses.dexterity ?? 0),
      social: this.rollStat() + (this.background.statBonuses.social ?? 0),
      resilience: this.rollStat() + (this.background.statBonuses.resilience ?? 0),
    };

    // Carry capacity based on strength
    this.inventory = new Inventory(5 + this.stats.strength);
    this.hp = this.maxHp;

    this.tileX = startX;
    this.tileY = startY;
    this.targetX = startX;
    this.targetY = startY;
    this.pixelX = startX * TILE_SIZE + TILE_SIZE / 2;
    this.pixelY = startY * TILE_SIZE + TILE_SIZE / 2;

    this.sprite = new Graphics();
    this.sprite.circle(0, 0, TILE_SIZE * 0.35).fill(0xd4a857);
    this.sprite.circle(0, 0, TILE_SIZE * 0.35).stroke({ color: 0xf0e0b0, width: 2 });

    this.nameLabel = new Text({
      text: this.name,
      style: { fontSize: 10, fill: 0xf0e8d0, fontFamily: 'Courier New' },
    });
    this.nameLabel.anchor.set(0.5, 1);
    this.nameLabel.y = -TILE_SIZE * 0.45;

    this.needsBars = new Container();
    this.needsBars.y = -TILE_SIZE * 0.55;
    this.updateNeedsBars();

    this.container.addChild(this.sprite);
    this.container.addChild(this.nameLabel);
    this.container.addChild(this.needsBars);
    this.updateVisualPosition();
  }

  private rollStat(): number {
    return 5 + Math.floor(Math.random() * 6);
  }

  addMorale(amount: number): void {
    this.morale = Math.min(MORALE_MAX, this.morale + amount);
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
  }

  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /** Work speed multiplier based on stats and morale */
  get workSpeed(): number {
    let speed = 1.0;
    // DEX gives build/scavenge speed
    speed += (this.stats.dexterity - 7) * 0.05;
    // Morale penalty
    if (this.morale < MORALE_LOW_THRESHOLD) speed *= 0.5;
    return Math.max(0.3, speed);
  }

  /** Movement speed multiplier */
  get moveSpeed(): number {
    let speed = 1.0;
    speed += (this.stats.dexterity - 7) * 0.03;
    if (this.background.title === 'Former Park Ranger') speed += 0.15;
    return Math.max(0.5, Math.min(1.5, speed));
  }

  /** Food efficiency — Chef background gets explicit bonus */
  get foodEfficiency(): number {
    let eff = 1.0 + (this.stats.intelligence - 7) * 0.03;
    if (this.background.title === 'Former Chef') eff += 0.25;
    return eff;
  }

  /** Build speed — Mechanic background gets explicit bonus */
  get buildSpeed(): number {
    let speed = this.workSpeed;
    if (this.background.title === 'Former Mechanic') speed += 0.25;
    return speed;
  }

  tick(
    resources: ResourceManager,
    stockpile: Stockpile,
    poiManager: POIManager,
    buildings: BuildingManager,
    isNight: boolean,
    threats?: ThreatInfo,
  ): void {
    if (this.state === 'dead') return;

    // HP death check
    if (this.hp <= 0) {
      this.die();
      return;
    }

    // Healing: slow natural regen, faster when resting, EMT bonus
    if (this.injured) {
      let healRate = 0.02; // base passive regen
      if (this.aiGoal === 'rest' || this.aiGoal === 'seek_bed') healRate = 0.15;
      if (this.background.title === 'Former EMT') healRate *= 2;
      this.heal(healRate);

      // Auto-consume medicine when injured
      const medicine = this.inventory.findByCategory('medicine');
      if (medicine) {
        this.heal(medicine.value);
        this.inventory.remove(medicine);
      }
    }

    // Decay needs
    this.hunger -= HUNGER_DECAY_PER_TICK;
    this.thirst -= THIRST_DECAY_PER_TICK;

    if ((isNight || this.aiGoal === 'seek_bed') && (this.aiGoal === 'rest' || this.aiGoal === 'seek_bed')) {
      // Rest recovery with building bonuses + EMT bonus
      let recoveryMult = 1 + buildings.getRestBonus(this.tileX, this.tileY);
      if (this.background.title === 'Former EMT') recoveryMult += 0.3;
      this.rest = Math.min(NEED_MAX, this.rest + REST_RECOVERY_PER_TICK * recoveryMult);
    } else {
      let restDecay = REST_DECAY_PER_TICK;
      if (this.background.title === 'Former Park Ranger') restDecay *= 0.75;
      this.rest -= restDecay;
    }

    this.hunger = Math.max(0, this.hunger);
    this.thirst = Math.max(0, this.thirst);
    this.rest = Math.max(0, this.rest);

    if (this.hunger <= 0 || this.thirst <= 0 || this.rest <= 0) {
      this.die();
      return;
    }

    // Morale decay & modifiers
    this.morale -= MORALE_DECAY_PER_TICK;
    // Needs-based morale effects
    if (this.hunger > 60 && this.thirst > 60 && this.rest > 60) this.morale += 0.015; // well-fed bonus
    if (this.hunger < 25) this.morale -= 0.02;
    if (this.thirst < 25) this.morale -= 0.02;
    // Shelter bonus
    if (buildings.isEnclosed(this.tileX, this.tileY)) this.morale += 0.01;
    this.morale = Math.max(0, Math.min(MORALE_MAX, this.morale));

    // Mental break check
    if (this.mentalBreak) {
      this.mentalBreakTimer++;
      if (this.mentalBreakTimer >= this.MENTAL_BREAK_DURATION) {
        this.mentalBreak = false;
        this.morale = MORALE_BREAK_THRESHOLD + 5; // recover slightly
      }
      // During mental break, just wander aimlessly
      this.moveTimer++;
      if (this.moveTimer >= this.MOVE_INTERVAL) {
        this.moveTimer = 0;
        this.pickRandomNeighbor(poiManager, buildings);
      }
      return;
    }
    if (this.morale < MORALE_BREAK_THRESHOLD && Math.random() < 0.02) {
      this.mentalBreak = true;
      this.mentalBreakTimer = 0;
      return;
    }

    // Handle active scavenging
    if (this.isScavenging) {
      this.scavengeTimer++;
      const scavengeTicks = Math.round(SCAVENGE_TICKS / this.workSpeed);
      if (this.scavengeTimer >= scavengeTicks) {
        this.finishScavenging(buildings);
      }
      return;
    }

    // Handle active building
    if (this.isBuilding && this.buildTarget) {
      this.buildTimer++;
      const buildInterval = Math.max(1, Math.round(3 / this.buildSpeed));
      if (this.buildTimer >= buildInterval) {
        this.buildTimer = 0;
        const done = buildings.progressBuild(this.buildTarget);
        if (done) {
          this.isBuilding = false;
          this.buildTarget = null;
        }
      }
      return;
    }

    // Handle active combat
    if (this.aiGoal === 'fight' && this.fightTarget && threats) {
      if (this.fightTarget.isDead) {
        this.fightTarget = null;
        this.combatTimer = 0;
      } else {
        const dx = this.fightTarget.tileX - this.tileX;
        const dy = this.fightTarget.tileY - this.tileY;
        if (dx * dx + dy * dy <= 2) {
          // Adjacent — attack on timer
          this.combatTimer++;
          const interval = Math.max(2, Math.round(this.COMBAT_INTERVAL / this.workSpeed));
          if (this.combatTimer >= interval) {
            this.combatTimer = 0;
            threats.attackEnemy(this.fightTarget, this.combatDamage);
          }
          return; // stay and fight
        }
        // Not adjacent — fall through to movement
      }
    }

    // Decide what to do
    this.decideGoal(resources, stockpile, poiManager, buildings, isNight, threats);

    // Try to consume from ground or stockpile
    this.tryConsume(resources, stockpile);

    // Auto-learn knowledge items in inventory
    this.tryLearnKnowledge(buildings);

    // Movement
    this.moveTimer++;
    if (this.moveTimer >= this.MOVE_INTERVAL) {
      this.moveTimer = 0;
      this.executeBehavior(resources, stockpile, poiManager, buildings, threats);
    }
  }

  private tryLearnKnowledge(buildings: BuildingManager): void {
    const knowledge = this.inventory.findByCategory('knowledge');
    if (knowledge) {
      const isNew = buildings.unlockKnowledge(knowledge.name);
      this.inventory.remove(knowledge);
      if (isNew) {
        // Teacher gets bigger morale boost from learning
        this.addMorale(this.background.title === 'Former Teacher' ? 8 : 3);
      }
    }
  }

  private decideGoal(
    resources: ResourceManager,
    stockpile: Stockpile,
    poiManager: POIManager,
    buildings: BuildingManager,
    isNight: boolean,
    threats?: ThreatInfo,
  ): void {
    // Fight nearby enemies (unless HP is critically low — flee by wandering)
    if (threats) {
      const enemy = threats.nearestEnemy(this.tileX, this.tileY, 10);
      if (enemy) {
        if (this.hp > this.maxHp * 0.25) {
          this.aiGoal = 'fight';
          this.fightTarget = enemy;
          this.combatTimer = 0;
          return;
        }
        // HP too low — don't fight, fall through to needs/wander
      }
    }

    // Urgent needs always override
    if (this.thirst < NEED_URGENT_THRESHOLD) {
      if (this.hasConsumable('water') || this.canFindConsumable('water', resources, stockpile)) {
        this.aiGoal = 'seek_water';
        return;
      }
    }
    if (this.hunger < NEED_URGENT_THRESHOLD) {
      if (this.hasConsumable('food') || this.canFindConsumable('food', resources, stockpile)) {
        this.aiGoal = 'seek_food';
        return;
      }
    }
    if (this.rest < NEED_URGENT_THRESHOLD || (isNight && this.rest < NEED_SEEK_THRESHOLD)) {
      // Try to find a bed for better rest
      const bed = buildings.findNearestBed(this.tileX, this.tileY, SEARCH_RADIUS);
      if (bed) {
        this.aiGoal = 'seek_bed';
        return;
      }
      this.aiGoal = 'rest';
      return;
    }

    // Normal needs
    if (this.thirst < NEED_SEEK_THRESHOLD) {
      if (this.hasConsumable('water') || this.canFindConsumable('water', resources, stockpile)) {
        this.aiGoal = 'seek_water';
        return;
      }
    }
    if (this.hunger < NEED_SEEK_THRESHOLD) {
      if (this.hasConsumable('food') || this.canFindConsumable('food', resources, stockpile)) {
        this.aiGoal = 'seek_food';
        return;
      }
    }

    // Pick work by player-set priority (1=high, 2=normal, 3=low, 0=disabled)
    type WorkCandidate = { type: 'haul' | 'build' | 'scavenge'; pri: number };
    const workCandidates: WorkCandidate[] = [];

    if (this.workPriorities.haul > 0 && !this.inventory.isEmpty() && stockpile.tiles.length > 0) {
      workCandidates.push({ type: 'haul', pri: this.workPriorities.haul });
    }

    let blueprint: Structure | null = null;
    if (this.workPriorities.build > 0) {
      blueprint = buildings.findNearestBlueprint(this.tileX, this.tileY, SEARCH_RADIUS);
      if (blueprint && buildings.canAfford(blueprint.type, stockpile)) {
        workCandidates.push({ type: 'build', pri: this.workPriorities.build });
      }
    }

    let nearestPOI: POI | null = null;
    if (this.workPriorities.scavenge > 0 && this.inventory.freeWeight >= 1) {
      poiManager.ensureAround(this.tileX, this.tileY, SEARCH_RADIUS);
      nearestPOI = poiManager.findNearestWithLoot(this.tileX, this.tileY, SEARCH_RADIUS);
      if (nearestPOI) {
        workCandidates.push({ type: 'scavenge', pri: this.workPriorities.scavenge });
      }
    }

    // Sort by priority (1 before 2 before 3)
    workCandidates.sort((a, b) => a.pri - b.pri);

    if (workCandidates.length > 0) {
      const best = workCandidates[0]!;
      if (best.type === 'haul') { this.aiGoal = 'haul_to_stockpile'; return; }
      if (best.type === 'build') { this.aiGoal = 'build'; this.buildTarget = blueprint!; return; }
      if (best.type === 'scavenge') { this.aiGoal = 'scavenge'; this.scavengeTarget = nearestPOI!; return; }
    }

    this.aiGoal = 'wander';
  }

  private hasConsumable(type: 'food' | 'water'): boolean {
    return this.inventory.findByCategory(type) !== undefined;
  }

  private canFindConsumable(
    type: 'food' | 'water',
    resources: ResourceManager,
    stockpile: Stockpile,
  ): boolean {
    // Check ground pickups
    if (resources.findNearest(this.tileX, this.tileY, type as ResourceType)) return true;
    // Check stockpile
    if (stockpile.countByCategory(type) > 0) return true;
    return false;
  }

  private consumeFood(): void {
    if (this.background.title === 'Former Chef') this.addMorale(2);
  }

  private tryConsume(resources: ResourceManager, stockpile: Stockpile): void {
    // Only consume from inventory when actually seeking that resource (need is low)
    if (this.aiGoal === 'seek_food' || this.hunger < NEED_SEEK_THRESHOLD) {
      const food = this.inventory.findByCategory('food');
      if (food) {
        this.hunger = Math.min(NEED_MAX, this.hunger + food.value * this.foodEfficiency);
        this.inventory.remove(food);
        this.consumeFood();
        return;
      }
    }
    if (this.aiGoal === 'seek_water' || this.thirst < NEED_SEEK_THRESHOLD) {
      const water = this.inventory.findByCategory('water');
      if (water) {
        this.thirst = Math.min(NEED_MAX, this.thirst + water.value);
        this.inventory.remove(water);
        return;
      }
    }

    // Try ground pickups only when need is low
    const pickup = resources.pickupAt(this.tileX, this.tileY);
    if (pickup) {
      if (pickup.type === 'food' && this.hunger < NEED_SEEK_THRESHOLD) {
        this.hunger = Math.min(NEED_MAX, this.hunger + pickup.amount);
        resources.remove(pickup);
        this.consumeFood();
      } else if (pickup.type === 'water' && this.thirst < NEED_SEEK_THRESHOLD) {
        this.thirst = Math.min(NEED_MAX, this.thirst + pickup.amount);
        resources.remove(pickup);
      }
    }

    // Try taking from stockpile if standing on a stockpile tile
    if (stockpile.hasTile(this.tileX, this.tileY)) {
      if (this.hunger < NEED_SEEK_THRESHOLD) {
        const food = stockpile.takeItem('food');
        if (food) {
          this.hunger = Math.min(NEED_MAX, this.hunger + food.value * this.foodEfficiency);
          this.consumeFood();
        }
      }
      if (this.thirst < NEED_SEEK_THRESHOLD) {
        const water = stockpile.takeItem('water');
        if (water) {
          this.thirst = Math.min(NEED_MAX, this.thirst + water.value);
        }
      }
    }
  }

  private executeBehavior(
    resources: ResourceManager,
    stockpile: Stockpile,
    poiManager: POIManager,
    buildings: BuildingManager,
    _threats?: ThreatInfo,
  ): void {
    switch (this.aiGoal) {
      case 'fight': {
        if (!this.fightTarget || this.fightTarget.isDead) {
          this.aiGoal = 'wander';
          this.fightTarget = null;
          return;
        }
        // Move toward enemy
        this.moveToward(this.fightTarget.tileX, this.fightTarget.tileY, poiManager, buildings);
        break;
      }

      case 'rest':
        return; // stay put

      case 'seek_bed': {
        const bed = buildings.findNearestBed(this.tileX, this.tileY, SEARCH_RADIUS);
        if (!bed) {
          this.aiGoal = 'rest';
          return;
        }
        if (this.tileX === bed.x && this.tileY === bed.y) {
          // On the bed — rest here (bonuses applied in tick via getRestBonus)
          return;
        }
        this.moveToward(bed.x, bed.y, poiManager, buildings);
        break;
      }

      case 'build': {
        if (!this.buildTarget || this.buildTarget.state === 'built') {
          this.aiGoal = 'wander';
          return;
        }

        if (this.tileX === this.buildTarget.x && this.tileY === this.buildTarget.y) {
          // Adjacent or on top — start building
          // Consume materials from stockpile
          for (const cost of this.buildTarget.def.costs) {
            for (let i = 0; i < cost.amount; i++) {
              stockpile.takeItem(cost.category);
            }
          }
          this.isBuilding = true;
          this.buildTimer = 0;
        } else {
          this.moveToward(this.buildTarget.x, this.buildTarget.y, poiManager, buildings);
        }
        break;
      }

      case 'seek_food':
      case 'seek_water': {
        const needType = this.aiGoal === 'seek_food' ? 'food' : 'water';

        // If we have it in inventory, consume next tick (stay put)
        if (this.hasConsumable(needType)) return;

        // Try stockpile first
        if (stockpile.countByCategory(needType as ItemCategory) > 0 && stockpile.tiles.length > 0) {
          const tile = stockpile.nearestTile(this.tileX, this.tileY);
          if (tile) {
            this.moveToward(tile.x, tile.y, poiManager, buildings);
            return;
          }
        }

        // Try ground pickups
        const nearest = resources.findNearest(this.tileX, this.tileY, needType as ResourceType);
        if (nearest) {
          this.moveToward(nearest.tileX, nearest.tileY, poiManager, buildings);
          return;
        }

        this.pickRandomNeighbor(poiManager, buildings);
        break;
      }

      case 'scavenge': {
        if (!this.scavengeTarget || this.scavengeTarget.scavengedFully) {
          this.aiGoal = 'wander';
          this.pickRandomNeighbor(poiManager, buildings);
          return;
        }

        const door = this.scavengeTarget;
        if (this.tileX === door.doorX && this.tileY === door.doorY) {
          this.isScavenging = true;
          this.scavengeTimer = 0;
        } else {
          this.moveToward(door.doorX, door.doorY, poiManager, buildings);
        }
        break;
      }

      case 'haul_to_stockpile': {
        const tile = stockpile.nearestTile(this.tileX, this.tileY);
        if (!tile) {
          this.aiGoal = 'wander';
          return;
        }

        if (this.tileX === tile.x && this.tileY === tile.y) {
          while (!this.inventory.isEmpty()) {
            const item = this.inventory.items[0]!;
            this.inventory.remove(item);
            stockpile.depositItem(item);
          }
        } else {
          this.moveToward(tile.x, tile.y, poiManager, buildings);
        }
        break;
      }

      case 'wander':
      default:
        this.pickRandomNeighbor(poiManager, buildings);
        break;
    }
  }

  private finishScavenging(buildings: BuildingManager): void {
    this.isScavenging = false;
    if (this.scavengeTarget) {
      const loot = this.scavengeTarget.rollLoot();
      for (const item of loot) {
        if (!this.inventory.add(item)) break; // inventory full
      }
      this.scavengeTarget.updateVisuals();
      // Auto-learn knowledge
      for (const item of [...this.inventory.items]) {
        if (item.category === 'knowledge') {
          const isNew = buildings.unlockKnowledge(item.name);
          this.inventory.remove(item);
          if (isNew) {
            this.addMorale(this.background.title === 'Former Teacher' ? 8 : 3);
          }
        }
      }
      this.scavengeTarget = null;
    }
  }

  private moveToward(goalX: number, goalY: number, poiManager: POIManager, buildings: BuildingManager): void {
    const dx = Math.sign(goalX - this.tileX);
    const dy = Math.sign(goalY - this.tileY);

    // Try direct greedy movement first (fast path)
    const candidates = [
      [dx, dy],
      [dx, 0],
      [0, dy],
    ].filter(([cx, cy]) => cx !== 0 || cy !== 0);

    for (const [cx, cy] of candidates) {
      const nx = this.tileX + cx!;
      const ny = this.tileY + cy!;
      if (this.canWalk(nx, ny, poiManager, buildings)) {
        this.targetX = nx;
        this.targetY = ny;
        return;
      }
    }

    // Greedy failed — use bounded BFS to find a path around obstacles
    const next = this.bfsNextStep(goalX, goalY, poiManager, buildings);
    if (next) {
      this.targetX = next[0];
      this.targetY = next[1];
      return;
    }

    this.pickRandomNeighbor(poiManager, buildings);
  }

  /** Bounded BFS to find first step toward goal, max 200 tiles explored */
  private bfsNextStep(
    goalX: number, goalY: number,
    poiManager: POIManager, buildings: BuildingManager,
  ): [number, number] | null {
    const maxExplore = 200;
    const startKey = `${this.tileX},${this.tileY}`;
    const visited = new Map<string, string | null>(); // key -> parent key
    const queue: [number, number][] = [[this.tileX, this.tileY]];
    visited.set(startKey, null);
    let head = 0;

    while (head < queue.length && visited.size < maxExplore) {
      const [cx, cy] = queue[head++]!;

      if (cx === goalX && cy === goalY) {
        // Trace back to find first step
        let current = `${cx},${cy}`;
        while (true) {
          const parent = visited.get(current);
          if (parent === null || parent === startKey) {
            const parts = current.split(',');
            return [parseInt(parts[0]!, 10), parseInt(parts[1]!, 10)];
          }
          current = parent!;
        }
      }

      const offsets: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1]];
      for (const [ox, oy] of offsets) {
        const nx = cx + ox;
        const ny = cy + oy;
        const nk = `${nx},${ny}`;
        if (visited.has(nk)) continue;
        if (!this.canWalk(nx, ny, poiManager, buildings)) continue;
        visited.set(nk, `${cx},${cy}`);
        queue.push([nx, ny]);
      }
    }

    return null; // no path found within budget
  }

  private pickRandomNeighbor(poiManager: POIManager, buildings: BuildingManager): void {
    const offsets = [
      [-1, 0], [1, 0], [0, -1], [0, 1],
      [-1, -1], [1, -1], [-1, 1], [1, 1],
    ];
    for (const arr of offsets.sort(() => Math.random() - 0.5)) {
      const [ox, oy] = arr as [number, number];
      const nx = this.tileX + ox;
      const ny = this.tileY + oy;
      if (this.canWalk(nx, ny, poiManager, buildings)) {
        this.targetX = nx;
        this.targetY = ny;
        return;
      }
    }
  }

  private canWalk(x: number, y: number, poiManager: POIManager, buildings: BuildingManager): boolean {
    return isWalkable(x, y) && !poiManager.isWall(x, y) && !buildings.blocksMovement(x, y);
  }

  private die(): void {
    this.state = 'dead';
    this.sprite.tint = 0x666666;
    this.nameLabel.style.fill = 0x888888;
    this.sprite.alpha = 0.5;
    this.nameLabel.alpha = 0.5;
    this.needsBars.visible = false;
  }

  updateVisuals(_delta: number): void {
    if (this.state === 'dead') return;

    // Pulse when scavenging
    if (this.isScavenging) {
      this.sprite.alpha = 0.5 + 0.3 * Math.sin(Date.now() / 200);
      this.updateVisualPosition();
      return;
    }
    this.sprite.alpha = 1;

    const goalX = this.targetX * TILE_SIZE + TILE_SIZE / 2;
    const goalY = this.targetY * TILE_SIZE + TILE_SIZE / 2;

    const dx = goalX - this.pixelX;
    const dy = goalY - this.pixelY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 1) {
      const step = Math.min(this.PIXEL_SPEED, dist);
      this.pixelX += (dx / dist) * step;
      this.pixelY += (dy / dist) * step;
    } else {
      this.pixelX = goalX;
      this.pixelY = goalY;
      this.tileX = this.targetX;
      this.tileY = this.targetY;
    }

    this.updateVisualPosition();
    this.updateNeedsBars();
  }

  private updateVisualPosition(): void {
    this.container.x = this.pixelX;
    this.container.y = this.pixelY;
  }

  private updateNeedsBars(): void {
    // Destroy old graphics to prevent GPU/PIXI object leak
    const children = this.needsBars.children;
    if (children && Symbol.iterator in children) {
      for (const child of children) {
        child.destroy();
      }
    }
    this.needsBars.removeChildren();
    const gfx = new Graphics();
    const barW = 24;
    const barH = 3;
    const gap = 2;
    const startX = -barW / 2;

    const bars: [number, number][] = [];
    // Only show HP bar when injured
    if (this.injured) {
      bars.push([(this.hp / this.maxHp) * 100, 0xc04040]);
    }
    bars.push(
      [this.hunger, 0xc47030],
      [this.thirst, 0x4090d0],
      [this.rest, 0x90b048],
      [this.morale, 0xc0a0d0],
    );

    bars.forEach(([value, color], i) => {
      const y = -(i * (barH + gap));
      gfx.rect(startX, y, barW, barH).fill({ color: 0x000000, alpha: 0.5 });
      const fillW = (value / NEED_MAX) * barW;
      if (fillW > 0) {
        gfx.rect(startX, y, fillW, barH).fill(color);
      }
    });

    this.needsBars.addChild(gfx);
  }

  get aiGoalLabel(): string {
    if (this.mentalBreak) return 'Mental break!';
    if (this.isScavenging) return 'Scavenging...';
    if (this.isBuilding) return 'Building...';
    switch (this.aiGoal) {
      case 'fight': return 'Fighting!';
      case 'wander': return 'Wandering';
      case 'seek_food': return 'Seeking food';
      case 'seek_water': return 'Seeking water';
      case 'rest': return 'Resting';
      case 'seek_bed': return 'Going to bed';
      case 'scavenge': return 'Heading to scavenge';
      case 'haul_to_stockpile': return 'Hauling to stockpile';
      case 'build': return 'Going to build';
    }
  }

  toJSON(): object {
    return {
      id: this.id,
      name: this.name,
      backgroundTitle: this.background.title,
      stats: this.stats,
      tileX: this.tileX,
      tileY: this.tileY,
      state: this.state,
      hp: this.hp,
      hunger: this.hunger,
      thirst: this.thirst,
      rest: this.rest,
      morale: this.morale,
      inventory: this.inventory.items,
      workPriorities: this.workPriorities,
    };
  }

  /** Restore survivor state from save data */
  loadFrom(data: Record<string, unknown>): void {
    this.tileX = (data['tileX'] as number) ?? this.tileX;
    this.tileY = (data['tileY'] as number) ?? this.tileY;
    this.targetX = this.tileX;
    this.targetY = this.tileY;
    this.pixelX = this.tileX * TILE_SIZE + TILE_SIZE / 2;
    this.pixelY = this.tileY * TILE_SIZE + TILE_SIZE / 2;
    this.state = (data['state'] as SurvivorState) ?? 'alive';
    this.hp = (data['hp'] as number) ?? this.maxHp;
    this.hunger = (data['hunger'] as number) ?? NEED_MAX;
    this.thirst = (data['thirst'] as number) ?? NEED_MAX;
    this.rest = (data['rest'] as number) ?? NEED_MAX;
    this.morale = (data['morale'] as number) ?? 70;
    if (data['workPriorities']) {
      this.workPriorities = data['workPriorities'] as WorkPriorities;
    }
    this.updateVisualPosition();
    if (this.state === 'dead') {
      this.die();
    }
  }

  /** Called when another survivor dies — morale hit */
  onAllyDeath(): void {
    this.morale = Math.max(0, this.morale - 15);
  }
}
