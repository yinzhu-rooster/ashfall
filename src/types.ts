export interface Stats {
  strength: number;
  intelligence: number;
  dexterity: number;
  social: number;
  resilience: number;
}

export interface Background {
  title: string;
  description: string;
  statBonuses: Partial<Stats>;
}

export const BACKGROUNDS: Background[] = [
  {
    title: 'Former Park Ranger',
    description: 'Knows the land. Moves faster, tougher against the elements.',
    statBonuses: { strength: 2, resilience: 2, dexterity: 1 },
  },
  {
    title: 'Former EMT',
    description: 'Trained to save lives under pressure.',
    statBonuses: { dexterity: 2, intelligence: 2, resilience: 1 },
  },
  {
    title: 'Former Mechanic',
    description: 'Can fix anything with enough scrap and stubbornness.',
    statBonuses: { strength: 2, intelligence: 2, dexterity: 1 },
  },
  {
    title: 'Former Teacher',
    description: 'Patient, resourceful, and a fast learner.',
    statBonuses: { intelligence: 3, social: 2 },
  },
  {
    title: 'Former Chef',
    description: 'Makes the most of whatever ingredients remain.',
    statBonuses: { dexterity: 2, social: 1, intelligence: 2 },
  },
];

export const FIRST_NAMES = [
  'Alex', 'Jordan', 'Morgan', 'Casey', 'Riley',
  'Quinn', 'Avery', 'Rowan', 'Sage', 'Ellis',
  'Kai', 'Blake', 'Dana', 'Jesse', 'Reese',
];

let nextSurvivorId = 1;
export function getNextSurvivorId(): number {
  return nextSurvivorId++;
}
export function resetSurvivorIds(): void {
  nextSurvivorId = 1;
}
