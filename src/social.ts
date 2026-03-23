import { Survivor } from './survivor';

/** Track relationships between survivor pairs */
export class SocialManager {
  // Bond score between pairs: key = sorted "idA|idB", value = bond strength (0-100)
  private bonds = new Map<string, number>();

  private bondKey(a: Survivor, b: Survivor): string {
    const ids = [a.id, b.id].sort((x, y) => x - y);
    return `${ids[0]}|${ids[1]}`;
  }

  getBond(a: Survivor, b: Survivor): number {
    return this.bonds.get(this.bondKey(a, b)) ?? 0;
  }

  /** Process social interactions for all alive survivors each tick */
  tick(survivors: Survivor[]): void {
    const alive = survivors.filter((s) => s.state === 'alive');

    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i]!;
        const b = alive[j]!;

        const dx = a.tileX - b.tileX;
        const dy = a.tileY - b.tileY;
        const distSq = dx * dx + dy * dy;

        // Adjacent (within 2 tiles) — they interact
        if (distSq <= 4) {
          const key = this.bondKey(a, b);
          const current = this.bonds.get(key) ?? 0;
          // Bond grows slowly, caps at 100
          this.bonds.set(key, Math.min(100, current + 0.05));

          // Morale boost from proximity — scales with bond
          const bondBonus = 0.01 + (current / 100) * 0.03;
          a.addMorale(bondBonus);
          b.addMorale(bondBonus);
        }
      }
    }
  }

  /** Get all bonds for a specific survivor, sorted by strength */
  getBondsFor(survivor: Survivor, allSurvivors: Survivor[]): { name: string; bond: number }[] {
    const result: { name: string; bond: number }[] = [];
    for (const other of allSurvivors) {
      if (other === survivor) continue;
      const bond = this.getBond(survivor, other);
      if (bond > 0) {
        result.push({ name: other.name, bond });
      }
    }
    return result.sort((a, b) => b.bond - a.bond);
  }
}
