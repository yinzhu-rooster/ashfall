import { HOURS_PER_DAY, MINUTES_PER_TICK } from './constants';

export type TimeSpeed = 0 | 1 | 3;

export class GameState {
  day = 1;
  hour = 6;
  minute = 0;
  totalTicks = 0;
  speed: TimeSpeed = 1;

  tick(): void {
    if (this.speed === 0) return;
    this.totalTicks++;
    this.minute += MINUTES_PER_TICK;
    if (this.minute >= 60) {
      this.minute = 0;
      this.hour++;
      if (this.hour >= HOURS_PER_DAY) {
        this.hour = 0;
        this.day++;
      }
    }
  }

  /** Night is 20:00 - 05:59 */
  get isNight(): boolean {
    return this.hour >= 20 || this.hour < 6;
  }

  /** 0 = full dark (midnight), 1 = full bright (noon). Smooth transitions. */
  get daylight(): number {
    const h = this.hour + this.minute / 60;
    // Sunrise 5-7, sunset 19-21
    if (h >= 7 && h <= 19) return 1;
    if (h >= 21 || h <= 5) return 0.25;
    if (h > 5 && h < 7) return 0.25 + 0.75 * ((h - 5) / 2);
    // 19 < h < 21
    return 1 - 0.75 * ((h - 19) / 2);
  }

  get timeString(): string {
    const hh = String(this.hour).padStart(2, '0');
    const mm = String(this.minute).padStart(2, '0');
    return `Day ${this.day} — ${hh}:${mm}`;
  }

  toJSON(): object {
    return {
      day: this.day,
      hour: this.hour,
      minute: this.minute,
      totalTicks: this.totalTicks,
    };
  }

  loadFrom(data: Record<string, number>): void {
    this.day = data['day'] ?? 1;
    this.hour = data['hour'] ?? 6;
    this.minute = data['minute'] ?? 0;
    this.totalTicks = data['totalTicks'] ?? 0;
  }
}
