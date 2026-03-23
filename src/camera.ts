import { Container } from 'pixi.js';
import { TILE_SIZE } from './constants';

export class Camera {
  x = 0;
  y = 0;
  zoom = 1;

  private dragging = false;
  private lastMouse = { x: 0, y: 0 };
  private keys = new Set<string>();

  private readonly MIN_ZOOM = 0.15;
  private readonly MAX_ZOOM = 3;
  private readonly PAN_SPEED = 12;

  constructor(private canvas: HTMLCanvasElement) {
    this.bindEvents();
  }

  centerOn(tileX: number, tileY: number): void {
    this.x = tileX * TILE_SIZE - window.innerWidth / 2;
    this.y = tileY * TILE_SIZE - window.innerHeight / 2;
  }

  screenToTile(screenX: number, screenY: number): { tx: number; ty: number } {
    const worldX = (screenX - window.innerWidth / 2) / this.zoom + this.x + window.innerWidth / 2;
    const worldY = (screenY - window.innerHeight / 2) / this.zoom + this.y + window.innerHeight / 2;
    return {
      tx: Math.floor(worldX / TILE_SIZE),
      ty: Math.floor(worldY / TILE_SIZE),
    };
  }

  apply(container: Container): void {
    container.x = -this.x * this.zoom + window.innerWidth / 2 * (1 - this.zoom);
    container.y = -this.y * this.zoom + window.innerHeight / 2 * (1 - this.zoom);
    container.scale.set(this.zoom);
  }

  update(): void {
    const speed = this.PAN_SPEED / this.zoom;
    if (this.keys.has('w') || this.keys.has('arrowup')) this.y -= speed;
    if (this.keys.has('s') || this.keys.has('arrowdown')) this.y += speed;
    if (this.keys.has('a') || this.keys.has('arrowleft')) this.x -= speed;
    if (this.keys.has('d') || this.keys.has('arrowright')) this.x += speed;
  }

  private bindEvents(): void {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1 || e.button === 2) {
        this.dragging = true;
        this.lastMouse = { x: e.clientX, y: e.clientY };
      }
    });
    window.addEventListener('mousemove', (e) => {
      if (this.dragging) {
        this.x -= (e.clientX - this.lastMouse.x) / this.zoom;
        this.y -= (e.clientY - this.lastMouse.y) / this.zoom;
        this.lastMouse = { x: e.clientX, y: e.clientY };
      }
    });
    window.addEventListener('mouseup', () => {
      this.dragging = false;
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      this.zoom = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, this.zoom * zoomFactor));
    }, { passive: false });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}
