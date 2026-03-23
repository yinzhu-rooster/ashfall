# Ashfall — Product Spec
### A post-apocalyptic colony survival sim

> RimWorld meets The Road. Manage a band of survivors on a ruined Earth — scavenge, build, defend, and rebuild civilization from the ashes.

---

## Core Concept

The world ended. Nuclear war, plague, climate collapse — the specifics are lost to time. What remains is a scarred Earth: crumbling cities, irradiated wastelands, overgrown suburbs, and scattered pockets of survivors. You guide a small group of survivors as they establish a settlement, scavenge the ruins of the old world, and try to build something worth living for.

Unlike RimWorld's alien frontier, the setting is *familiar*. Survivors loot grocery stores, not alien ruins. They shelter in gas stations, not crashed pods. The horror is recognizing what was lost.

**The player's role:** You are a detached overseer — you designate zones, set work priorities, and queue orders, but you do not directly control survivors. Survivors act autonomously based on their needs, skills, and your priority settings. Your core loop: **designate → prioritize → observe → intervene when things go wrong.** This is a management sim, not an action game.

---

## Setting & Tone

- **When:** ~50 years after collapse. Nature is reclaiming. Some old-world tech still works, most doesn't.
- **Where:** Procedurally generated regions of post-apocalyptic Earth — suburbs, cities, farmland, highways, forests.
- **Tone:** Gritty survival with moments of hope. Dark but not nihilistic. Small human stories against a bleak backdrop.
- **Inspiration:** The Road, Station Eleven, RimWorld, Kenshi, Project Zomboid.

---

## Core Pillars

1. **Scavenge, Don't Manufacture** — Early game is about finding and repurposing, not crafting from scratch. You raid a hardware store for nails, not smelt iron ore.
2. **People, Not Pawns** — Survivors have backstories tied to the old world that mechanically shape gameplay. A former mechanic repairs faster. A former therapist stabilizes mental breaks. A former teacher accelerates knowledge unlocks. Identity is not flavor text — it drives what each survivor is best at and how they cope.
3. **The Ruins Tell Stories** — The map is littered with environmental storytelling. A barricaded school. A highway pileup. A bunker someone sealed from the inside.
4. **Rebuild, Not Replicate** — You're not restoring the old world. You're making something new from its bones.

---

## Key Systems

### 1. Survivors
- Each survivor has **stats** (strength, intelligence, dexterity, social, resilience)
- **Skills** derived from old-world background (e.g., "Former EMT" → medical skill, stress resistance)
- **Morale & trauma** system — survivors have mental states affected by events, conditions, and relationships
- **Relationships** — bonds, rivalries, romance form organically through proximity and shared experience
- **Needs** — hunger, thirst, rest, shelter, safety, social, purpose

### 2. Map & World
- **Tile-based top-down 2D** world (similar to RimWorld's perspective)
- **Biomes** pulled from real-world geography: suburban ruins, downtown cores, industrial zones, overgrown farmland, highways, forests, irradiated zones
- **Points of interest** — pre-placed structures to explore and loot (supermarkets, hospitals, military checkpoints, residential blocks)
- **Day/night cycle** and **seasons** affect gameplay (winter = scarce food, night = danger)
- **Weather** — rain, storms, heatwaves, cold snaps, rad-storms

### 3. Scavenging & Resources
- **Loot tables** tied to location type (pharmacy → meds, school → books/paper, warehouse → bulk supplies)
- **Resource categories:**
  - Food & Water (canned goods, purified water, crops, hunted game)
  - Materials (scrap metal, wood, concrete, glass, wire, fabric)
  - Medicine (bandages, antibiotics, painkillers, surgical kits)
  - Tech (batteries, electronics, fuel, solar panels)
  - Ammo & Weapons
  - Knowledge (books, manuals, schematics — unlock crafting/research)
- Resources **degrade** (deferred — introduce after threats are working) — canned food expires, batteries drain, medicine loses potency. Scarcity from raids is more interesting than scarcity from timers.

### 4. Base Building
- Repurpose existing structures or build from scratch using scavenged materials
- **Rooms & zones:** sleeping quarters, kitchen, med bay, workshop, farm plots, walls, gates, watchtowers
- **Utilities:** water collection, generators, solar rigs, heating
- **Defenses:** walls, traps, turrets, guard posts
- **Condition system** — structures decay and need maintenance

### 5. Threats
- **Raiders** — hostile survivor factions that attack or demand tribute
- **Wildlife** — mutated or feral animals, from scavenging dogs to apex predators
- **Environment** — radiation zones, structural collapses, disease outbreaks, harsh weather
- **Internal** — mental breaks, betrayal, infighting, addiction
- **Scarcity** — the ever-present threat of running out

### 6. Factions & Trade
- Other survivor groups exist on the world map with their own settlements
- **Reputation system** — your actions determine relationships (trade partner, rival, enemy)
- **Trade caravans** for exchanging surplus resources
- **Quests/requests** from other factions (rescue missions, supply trades, joint defense)

### 7. Research & Progression
- Not a traditional tech tree — progression is gated by **finding knowledge** (books, schematics, skilled survivors)
- Examples: finding a farming manual unlocks crop rotation, recruiting an electrician unlocks solar panel installation
- Late game unlocks: radio communication, vehicle repair, advanced medicine, fortified construction

---

## Iterative Build Plan

Each milestone should be **playable** on its own, even if minimal.

### Milestone 0 — Foundation
> Get something on screen that moves.
- **Control scheme (decided):** Pause-and-play with priority-based task assignment (RimWorld-style). The player designates zones and sets priorities; survivors act autonomously. This is the right fit for a solo dev project — real-time direct control would require far more animation, input handling, and combat tuning. This decision is load-bearing for every subsequent milestone.
- [ ] Choose tech stack (web-based: TypeScript + Canvas/Pixi.js recommended for vibe coding speed)
- [ ] Tile-based map rendering (simple grid, a few terrain types)
- [ ] Camera controls (pan, zoom)
- [ ] Place a single "survivor" entity on the map with an old-world background (proof-of-concept for "People, Not Pawns" — e.g., "Former Park Ranger" affects starting stats). Full background system comes in M4, but identity should be visible from the start.
- [ ] Basic autonomous movement (AI wander based on priorities, not click-to-move — consistent with the pause-and-play control scheme)
- [ ] Basic UI shell: time controls (play/pause/speed), selected-entity panel, resource counters

### Milestone 1 — Survival Loop
> A survivor that needs things and can die.
- [ ] Needs system (hunger, thirst, rest)
- [ ] Time progression (day/night cycle)
- [ ] Basic resource pickups on the map (food, water)
- [ ] Survivor AI: seek resources when needs are low
- [ ] Death when needs hit zero
- [ ] Save/load system (JSON serialization to localStorage) — needed for meaningful playtesting
- **Playtest gate:** Can you keep one survivor alive by placing resources?

### Milestone 2a — Inventory & Storage
> Survivors can carry and store things.
- [ ] Inventory system (survivor carries items, capacity limited by strength)
- [ ] Stockpile zone designation (drop items at base)
- [ ] Hauling task — survivors move items between inventory and stockpile based on priorities
- **Playtest gate:** Survivor picks up a resource, carries it, and deposits it in a stockpile zone.

### Milestone 2b — Scavenging
> The world has places worth exploring.
- [ ] Points of interest generation (simple buildings on the map)
- [ ] Enter/explore POIs
- [ ] Loot tables per building type
- [ ] Scavenge task — survivors autonomously loot POIs and haul back to stockpile
- **Playtest gate:** Survivor can scavenge a building and bring loot home.

### Milestone 3 — Base Building
> Make a place to live.
- [ ] Place-able structures (walls, floors, doors, beds, campfire)
- [ ] Room detection (enclosed spaces)
- [ ] Build tasks — survivors haul materials and construct
- [ ] Basic shelter effects (rest quality, temperature)
- [ ] Knowledge-gated building — some structures require finding schematics/manuals first (e.g., "carpentry basics" to unlock wall construction). Reinforces the "Scavenge, Don't Manufacture" pillar early.
- **Playtest gate:** Build a small shelter that improves survivor rest.

### Milestone 4 — Multiple Survivors & Social
> You're managing a group now.
- [ ] Multiple survivors with different stats/backgrounds
- [ ] Old-world background system — backgrounds grant concrete mechanical bonuses (Former EMT: faster healing, Former Mechanic: faster repairs, Former Teacher: knowledge unlock speed boost, Former Chef: better food efficiency)
- [ ] Task prioritization / job assignment
- [ ] Basic morale system
- [ ] Simple social interactions (talk, bond)
- [ ] Recruitment events (stranger arrives)
- **Playtest gate:** Manage 3+ survivors with different roles, where backgrounds meaningfully affect task performance.

### Milestone 5 — Threats
> Something is trying to kill you.
- [ ] Hostile entities (raiders, feral animals)
- [ ] Combat system (melee & ranged, simple)
- [ ] Defensive structures (walls block pathing, turrets)
- [ ] Raid events (periodic attacks)
- [ ] Injury & medical treatment
- **Playtest gate:** Survive a raid.

### Milestone 6 — Weather & Seasons
> The environment fights back.
- [ ] Weather system (rain, storms, heatwaves, cold snaps, rad-storms)
- [ ] Seasons affecting food availability and temperature
- [ ] Resource degradation now activates (food expires, medicine loses potency)
- [ ] Survivors respond to weather (seek shelter, equip warm clothing)
- **Playtest gate:** Survive a full year cycle where winter creates real scarcity pressure.

### Milestone 7 — Research & Progression
> Knowledge is the real currency.
- [ ] Expand knowledge system from M3 — full schematic/book discovery system
- [ ] Skilled survivors as knowledge sources (recruiting an electrician unlocks solar panels)
- [ ] Late-game unlocks: radio communication, vehicle repair, advanced medicine, fortified construction
- [ ] Research station structure for studying found materials
- **Playtest gate:** Progression feels earned through exploration, not arbitrary.

### Milestone 8 — Factions & Trade
> You're not alone out here.
- [ ] Other survivor groups on the world map with their own settlements
- [ ] Reputation system — actions determine relationships (trade partner, rival, enemy)
- [ ] Trade caravans for exchanging surplus resources
- [ ] Quests/requests from other factions (rescue missions, supply trades, joint defense)
- **Playtest gate:** Complete a trade and a faction quest.

### Milestone 9 — Events & Polish
> Make it feel real.
- [ ] Events system (story beats, random occurrences, environmental storytelling moments)
- [ ] Ambient audio and sound effects (footsteps, weather, UI feedback, ambient environmental sounds — outsized impact on tone for relatively low effort)
- [ ] UI polish, tooltips, survivor detail panels
- [ ] Balance pass across all systems
- [ ] Tutorial / onboarding hints
- **Playtest gate:** A new player can survive 3 in-game seasons without a tutorial walkthrough, and the game generates at least 2 emergent narrative moments per in-game year.

---

## Tech Considerations (for vibe coding)

| Consideration | Recommendation |
|---|---|
| **Platform** | Web (browser-based) — fastest iteration loop |
| **Language** | TypeScript — type safety without overhead |
| **Rendering** | Pixi.js or plain Canvas2D — start simple, upgrade later |
| **State mgmt** | Plain objects/classes to start — no framework until needed |
| **Art style** | Start with colored rectangles/simple shapes. Swap in pixel art later. |
| **Save system** | JSON serialization to localStorage, then files |
| **Build tool** | Vite — fast HMR, zero config |

---

## Design Decisions

- **Control scheme:** Pause-and-play with priority-based task assignment (RimWorld-style). The player designates, prioritizes, and intervenes — survivors execute autonomously. This is not negotiable for v1; switching to real-time direct control would invalidate the AI, UI, and combat designs.
- **Win condition:** Sandbox for v1. No explicit win state — emergent stories are the goal. Consider optional narrative objectives (radio contact, population milestones) post-v1.
- **Tone:** PG-13 for v1. Dark themes through implication and environmental storytelling, not explicit content. No child survivors or cannibalism mechanics initially.
- **Multiplayer:** No. Single-player only for v1. Architecture should not over-engineer for future multiplayer.
- **Mobile:** No. Desktop browser only for v1. Touch controls would change too many UI assumptions.
- **Audio:** Deferred to M9. Ambient sound and SFX are high-impact for tone but low-priority until core systems work.

## What This Game is NOT

- **Not a city builder** — you're managing 3–20 survivors, not a population of thousands. Every person matters.
- **Not a roguelike** — no permadeath-and-restart loop. You live with consequences and adapt.
- **Not a tower defense** — combat is one threat among many, not the core loop. A colony that never fights but starves has still failed.
- **Not a 4X game** — you don't expand across the map conquering territory. You hold one place and make it livable.
- **Not a crafting game** — you scavenge and repurpose. Crafting exists but is late-game and knowledge-gated, never the primary resource loop.

---

*Working title: **Ashfall***
*Tagline: "Rebuild from the ashes."*
