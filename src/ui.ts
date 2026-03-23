import { GameState, TimeSpeed } from './gamestate';
import { Survivor } from './survivor';
import { Stockpile } from './stockpile';
import { POI } from './poi';
import { ItemCategory } from './items';
import { BuildingManager, StructureType, STRUCTURE_DEFS } from './building';
import { SocialManager } from './social';
import { WorkType, WorkPriority } from './types';
import type { Enemy } from './combat';

export type InteractionMode = 'select' | 'stockpile' | 'build';

export class UI {
  private btnPause: HTMLButtonElement;
  private btnPlay: HTMLButtonElement;
  private btnFast: HTMLButtonElement;
  private timeDisplay: HTMLElement;
  private resFood: HTMLElement;
  private resWater: HTMLElement;
  private resMaterials: HTMLElement;
  private entityPanel: HTMLElement;
  private panelName: HTMLElement;
  private panelBackground: HTMLElement;
  private panelNeeds: HTMLElement;
  private panelActivity: HTMLElement;
  private panelPriorities: HTMLElement;
  private panelStats: HTMLElement;
  private panelInventory: HTMLElement;
  private btnSave: HTMLButtonElement;
  private btnLoad: HTMLButtonElement;
  private deathOverlay: HTMLElement;
  private btnRestart: HTMLButtonElement;
  private btnStockpile: HTMLButtonElement;
  private btnBuild: HTMLButtonElement;
  private buildMenu: HTMLElement;
  private modeIndicator: HTMLElement;
  private survivorList: HTMLElement;
  private raidWarning: HTMLElement;

  interactionMode: InteractionMode = 'select';
  selectedBuildType: StructureType | null = null;

  onSurvivorSelect: ((survivor: Survivor) => void) | null = null;

  // Dirty tracking to avoid rebuilding DOM every frame
  private lastSurvivorListHash = '';
  private lastBuildMenuMode: InteractionMode | null = null;
  private lastBuildMenuType: StructureType | null = null;
  private lastBuildMenuKnowledge = '';
  private lastTimeString = '';
  private lastFoodCount = -1;
  private lastWaterCount = -1;
  private lastMaterialsCount = -1;
  private lastSpeed: TimeSpeed = -1 as TimeSpeed;

  constructor() {
    this.btnPause = document.getElementById('btn-pause') as HTMLButtonElement;
    this.btnPlay = document.getElementById('btn-play') as HTMLButtonElement;
    this.btnFast = document.getElementById('btn-fast') as HTMLButtonElement;
    this.timeDisplay = document.getElementById('time-display')!;
    this.resFood = document.getElementById('res-food')!;
    this.resWater = document.getElementById('res-water')!;
    this.resMaterials = document.getElementById('res-materials')!;
    this.entityPanel = document.getElementById('entity-panel')!;
    this.panelName = document.getElementById('panel-name')!;
    this.panelBackground = document.getElementById('panel-background')!;
    this.panelNeeds = document.getElementById('panel-needs')!;
    this.panelActivity = document.getElementById('panel-activity')!;
    this.panelPriorities = document.getElementById('panel-priorities')!;
    this.panelStats = document.getElementById('panel-stats')!;
    this.panelInventory = document.getElementById('panel-inventory')!;
    this.btnSave = document.getElementById('btn-save') as HTMLButtonElement;
    this.btnLoad = document.getElementById('btn-load') as HTMLButtonElement;
    this.deathOverlay = document.getElementById('death-overlay')!;
    this.btnRestart = document.getElementById('btn-restart') as HTMLButtonElement;
    this.btnStockpile = document.getElementById('btn-stockpile') as HTMLButtonElement;
    this.btnBuild = document.getElementById('btn-build') as HTMLButtonElement;
    this.buildMenu = document.getElementById('build-menu')!;
    this.modeIndicator = document.getElementById('mode-indicator')!;
    this.survivorList = document.getElementById('survivor-list')!;
    this.raidWarning = document.getElementById('raid-warning')!;

    this.btnStockpile.addEventListener('click', () => {
      this.setMode(this.interactionMode === 'stockpile' ? 'select' : 'stockpile');
    });

    this.btnBuild.addEventListener('click', () => {
      this.setMode(this.interactionMode === 'build' ? 'select' : 'build');
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.setMode('select');
      }
    });
  }

  bindSpeedButtons(onSpeed: (speed: TimeSpeed) => void): void {
    this.btnPause.addEventListener('click', () => onSpeed(0));
    this.btnPlay.addEventListener('click', () => onSpeed(1));
    this.btnFast.addEventListener('click', () => onSpeed(3));
  }

  bindSaveLoad(onSave: () => void, onLoad: () => void): void {
    this.btnSave.addEventListener('click', onSave);
    this.btnLoad.addEventListener('click', onLoad);
  }

  bindRestart(onRestart: () => void): void {
    this.btnRestart.addEventListener('click', onRestart);
  }

  update(state: GameState, stockpile: Stockpile): void {
    if (this.lastTimeString !== state.timeString) {
      this.timeDisplay.textContent = state.timeString;
      this.lastTimeString = state.timeString;
    }

    const food = stockpile.countByCategory('food');
    const water = stockpile.countByCategory('water');
    const materials = stockpile.countByCategory('materials');

    if (food !== this.lastFoodCount) {
      this.resFood.textContent = String(food);
      this.lastFoodCount = food;
    }
    if (water !== this.lastWaterCount) {
      this.resWater.textContent = String(water);
      this.lastWaterCount = water;
    }
    if (materials !== this.lastMaterialsCount) {
      this.resMaterials.textContent = String(materials);
      this.lastMaterialsCount = materials;
    }

    if (state.speed !== this.lastSpeed) {
      this.btnPause.classList.toggle('active', state.speed === 0);
      this.btnPlay.classList.toggle('active', state.speed === 1);
      this.btnFast.classList.toggle('active', state.speed === 3);
      this.lastSpeed = state.speed;
    }
  }

  showSurvivor(survivor: Survivor, social?: SocialManager, allSurvivors?: Survivor[]): void {
    this.entityPanel.classList.remove('hidden');
    this.panelName.textContent = survivor.name;
    this.panelBackground.textContent = survivor.background.title;

    // Activity
    this.panelActivity.textContent = survivor.state === 'dead' ? 'Dead' : survivor.aiGoalLabel;

    // Needs
    this.panelNeeds.innerHTML = '';
    const needs: [string, string, number][] = [];
    if (survivor.injured) {
      needs.push(['HP', 'hp', (survivor.hp / survivor.maxHp) * 100]);
    }
    needs.push(
      ['Hunger', 'food', survivor.hunger],
      ['Thirst', 'water', survivor.thirst],
      ['Rest', 'rest', survivor.rest],
      ['Morale', 'morale', survivor.morale],
    );
    for (const [label, cls, value] of needs) {
      const row = document.createElement('div');
      row.className = 'need-row';
      row.innerHTML = `
        <span class="need-label">${label}</span>
        <div class="need-bar-bg"><div class="need-bar-fill ${cls}" style="width:${value}%"></div></div>
        <span class="need-value">${Math.round(value)}</span>
      `;
      this.panelNeeds.appendChild(row);
    }

    // Work priorities (only for alive survivors)
    this.panelPriorities.innerHTML = '';
    if (survivor.state === 'alive') {
      const priHeader = document.createElement('div');
      priHeader.className = 'inventory-header';
      priHeader.textContent = 'Work Priorities';
      this.panelPriorities.appendChild(priHeader);

      const workTypes: WorkType[] = ['haul', 'build', 'scavenge'];
      const workLabels: Record<WorkType, string> = { haul: 'Haul', build: 'Build', scavenge: 'Scavenge' };
      const priLabels = ['Off', '!!!', '!!', '!'];

      for (const wt of workTypes) {
        const row = document.createElement('div');
        row.className = 'priority-row';

        const label = document.createElement('span');
        label.className = 'priority-label';
        label.textContent = workLabels[wt];

        const btn = document.createElement('button');
        btn.className = 'priority-btn';
        const pri = survivor.workPriorities[wt];
        btn.textContent = priLabels[pri]!;
        btn.dataset['pri'] = String(pri);
        btn.addEventListener('click', () => {
          survivor.workPriorities[wt] = ((survivor.workPriorities[wt] + 1) % 4) as WorkPriority;
        });

        row.appendChild(label);
        row.appendChild(btn);
        this.panelPriorities.appendChild(row);
      }
    }

    // Inventory
    this.panelInventory.innerHTML = '';
    if (survivor.inventory.items.length > 0) {
      const header = document.createElement('div');
      header.className = 'inventory-header';
      header.textContent = `Carrying (${survivor.inventory.currentWeight.toFixed(1)}/${survivor.inventory.maxWeight})`;
      this.panelInventory.appendChild(header);

      for (const item of survivor.inventory.items) {
        const row = document.createElement('div');
        row.className = 'inventory-item';
        row.innerHTML = `<span class="item-name">${item.name}</span><span class="item-weight">${item.weight}kg</span>`;
        this.panelInventory.appendChild(row);
      }
    } else {
      const empty = document.createElement('div');
      empty.className = 'inventory-header';
      empty.textContent = 'Carrying nothing';
      this.panelInventory.appendChild(empty);
    }

    // Relationships
    if (social && allSurvivors) {
      const bonds = social.getBondsFor(survivor, allSurvivors);
      if (bonds.length > 0) {
        const relHeader = document.createElement('div');
        relHeader.className = 'inventory-header';
        relHeader.textContent = 'Relationships';
        this.panelInventory.appendChild(relHeader);

        for (const b of bonds.slice(0, 5)) {
          const row = document.createElement('div');
          row.className = 'inventory-item';
          const label = b.bond > 50 ? 'Friend' : b.bond > 20 ? 'Acquaintance' : 'Stranger';
          row.innerHTML = `<span class="item-name">${b.name}</span><span class="item-weight">${label}</span>`;
          this.panelInventory.appendChild(row);
        }
      }
    }

    // Stats
    this.panelStats.innerHTML = '';
    const entries: [string, number][] = [
      ['STR', survivor.stats.strength],
      ['INT', survivor.stats.intelligence],
      ['DEX', survivor.stats.dexterity],
      ['SOC', survivor.stats.social],
      ['RES', survivor.stats.resilience],
    ];
    for (const [label, value] of entries) {
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.innerHTML = `<span class="stat-label">${label}</span><span class="stat-value">${value}</span>`;
      this.panelStats.appendChild(row);
    }
  }

  showPOI(poi: POI): void {
    this.entityPanel.classList.remove('hidden');
    this.panelName.textContent = poi.type.charAt(0).toUpperCase() + poi.type.slice(1);
    this.panelBackground.textContent = poi.scavengedFully ? 'Fully scavenged' : `Loot remaining: ${poi.lootRemaining}/${poi.maxLoot}`;
    this.panelNeeds.innerHTML = '';
    this.panelActivity.textContent = '';
    this.panelPriorities.innerHTML = '';
    this.panelInventory.innerHTML = '';
    this.panelStats.innerHTML = '';
  }

  showStockpileInfo(stockpile: Stockpile): void {
    this.entityPanel.classList.remove('hidden');
    this.panelName.textContent = 'Stockpile';
    this.panelBackground.textContent = `${stockpile.tiles.length} tiles, ${stockpile.items.length} items`;
    this.panelNeeds.innerHTML = '';
    this.panelActivity.textContent = '';
    this.panelPriorities.innerHTML = '';
    this.panelStats.innerHTML = '';

    // Show item breakdown
    this.panelInventory.innerHTML = '';
    const categories: ItemCategory[] = ['food', 'water', 'medicine', 'materials', 'knowledge'];
    for (const cat of categories) {
      const count = stockpile.countByCategory(cat);
      if (count > 0) {
        const row = document.createElement('div');
        row.className = 'inventory-item';
        row.innerHTML = `<span class="item-name">${cat}</span><span class="item-weight">x${count}</span>`;
        this.panelInventory.appendChild(row);
      }
    }
  }

  updateSurvivorList(survivors: Survivor[], selected: Survivor | null): void {
    // Build a hash to detect changes — avoid full DOM rebuild every frame
    const hash = survivors.map((s) => {
      const lowest = Math.min(s.hunger, s.thirst, s.rest);
      return `${s.name}:${s.state}:${Math.round(lowest)}:${s === selected ? 1 : 0}:${s.injured ? 1 : 0}`;
    }).join('|');
    if (hash === this.lastSurvivorListHash) return;
    this.lastSurvivorListHash = hash;

    this.survivorList.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'survivor-list-header';
    header.textContent = `Survivors (${survivors.filter((s) => s.state === 'alive').length}/${survivors.length})`;
    this.survivorList.appendChild(header);

    for (const s of survivors) {
      const entry = document.createElement('div');
      entry.className = 'survivor-list-entry';
      if (s === selected) entry.classList.add('selected');
      if (s.state === 'dead') entry.classList.add('dead');

      const dot = document.createElement('div');
      dot.className = 'survivor-dot';
      if (s.state === 'dead') dot.classList.add('dead');
      else if (s.injured) dot.classList.add('injured');

      const name = document.createElement('span');
      name.className = 'survivor-entry-name';
      name.textContent = s.name;

      const status = document.createElement('span');
      status.className = 'survivor-entry-status';
      if (s.state === 'dead') {
        status.textContent = 'Dead';
      } else {
        // Show lowest need as a quick health indicator
        const lowest = Math.min(s.hunger, s.thirst, s.rest);
        status.textContent = `${Math.round(lowest)}%`;
        if (lowest < 20) status.style.color = '#c04030';
        else if (lowest < 40) status.style.color = '#c8a030';
      }

      entry.appendChild(dot);
      entry.appendChild(name);
      entry.appendChild(status);

      entry.addEventListener('click', () => {
        this.onSurvivorSelect?.(s);
      });

      this.survivorList.appendChild(entry);
    }
  }

  showEnemy(enemy: Enemy): void {
    this.entityPanel.classList.remove('hidden');
    this.panelName.textContent = enemy.def.label;
    this.panelBackground.textContent = `HP: ${Math.round(enemy.hp)}/${enemy.maxHp}`;
    this.panelNeeds.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'need-row';
    const hpPct = (enemy.hp / enemy.maxHp) * 100;
    row.innerHTML = `
      <span class="need-label">HP</span>
      <div class="need-bar-bg"><div class="need-bar-fill hp" style="width:${hpPct}%"></div></div>
      <span class="need-value">${Math.round(enemy.hp)}</span>
    `;
    this.panelNeeds.appendChild(row);
    this.panelActivity.textContent = `Damage: ${enemy.def.damage}`;
    this.panelPriorities.innerHTML = '';
    this.panelInventory.innerHTML = '';
    this.panelStats.innerHTML = '';
  }

  updateRaidWarning(status: string | null): void {
    if (status) {
      this.raidWarning.textContent = status;
      this.raidWarning.classList.remove('hidden');
    } else {
      this.raidWarning.classList.add('hidden');
    }
  }

  hidePanel(): void {
    this.entityPanel.classList.add('hidden');
  }

  showDeath(): void {
    this.deathOverlay.classList.remove('hidden');
  }

  hideDeath(): void {
    this.deathOverlay.classList.add('hidden');
  }

  private setMode(mode: InteractionMode): void {
    this.interactionMode = mode;
    if (mode !== 'build') {
      this.selectedBuildType = null;
    }
    this.updateModeIndicator();
  }

  updateBuildMenu(buildings: BuildingManager): void {
    const knowledgeHash = buildings.knowledgeList.join(',');
    if (this.lastBuildMenuMode === this.interactionMode &&
        this.lastBuildMenuType === this.selectedBuildType &&
        this.lastBuildMenuKnowledge === knowledgeHash) {
      return; // no change
    }
    this.lastBuildMenuMode = this.interactionMode;
    this.lastBuildMenuType = this.selectedBuildType;
    this.lastBuildMenuKnowledge = knowledgeHash;

    this.buildMenu.innerHTML = '';
    if (this.interactionMode !== 'build') {
      this.buildMenu.classList.add('hidden');
      return;
    }
    this.buildMenu.classList.remove('hidden');

    const allTypes = Object.keys(STRUCTURE_DEFS) as StructureType[];
    for (const type of allTypes) {
      const def = STRUCTURE_DEFS[type];
      const unlocked = buildings.isUnlocked(type);

      const btn = document.createElement('button');
      btn.className = 'build-option';
      if (this.selectedBuildType === type) btn.classList.add('selected');
      if (!unlocked) btn.classList.add('locked');

      const swatch = document.createElement('div');
      swatch.className = 'build-swatch';
      swatch.style.backgroundColor = `#${def.color.toString(16).padStart(6, '0')}`;

      const label = document.createElement('span');
      label.textContent = def.label;

      const cost = document.createElement('span');
      cost.className = 'build-cost';
      if (!unlocked) {
        cost.textContent = `Needs: ${def.requiredKnowledge}`;
      } else {
        cost.textContent = def.costs.map((c) => `${c.amount} ${c.category}`).join(', ');
      }

      btn.appendChild(swatch);
      btn.appendChild(label);
      btn.appendChild(cost);

      if (unlocked) {
        btn.addEventListener('click', () => {
          this.selectedBuildType = this.selectedBuildType === type ? null : type;
          this.updateBuildMenu(buildings);
          this.updateModeIndicator();
        });
      }

      this.buildMenu.appendChild(btn);
    }
  }

  private updateModeIndicator(): void {
    this.btnStockpile.classList.toggle('active', this.interactionMode === 'stockpile');
    this.btnBuild.classList.toggle('active', this.interactionMode === 'build');

    if (this.interactionMode === 'stockpile') {
      this.modeIndicator.textContent = 'Click tiles to designate stockpile (ESC to cancel)';
      this.modeIndicator.classList.remove('hidden');
    } else if (this.interactionMode === 'build' && this.selectedBuildType) {
      const def = STRUCTURE_DEFS[this.selectedBuildType];
      this.modeIndicator.textContent = `Place ${def.label} — click to place blueprint (ESC to cancel)`;
      this.modeIndicator.classList.remove('hidden');
    } else if (this.interactionMode === 'build') {
      this.modeIndicator.textContent = 'Select a structure to build';
      this.modeIndicator.classList.remove('hidden');
    } else {
      this.modeIndicator.classList.add('hidden');
    }
  }

  showStructure(s: { type: string; state: string; buildProgress: number; def: { buildTicks: number; label: string } }): void {
    this.entityPanel.classList.remove('hidden');
    this.panelName.textContent = s.def.label;
    this.panelBackground.textContent = s.state === 'built'
      ? 'Built'
      : `Building... ${Math.round((s.buildProgress / s.def.buildTicks) * 100)}%`;
    this.panelNeeds.innerHTML = '';
    this.panelActivity.textContent = '';
    this.panelPriorities.innerHTML = '';
    this.panelInventory.innerHTML = '';
    this.panelStats.innerHTML = '';
  }
}
