import { TickSystem, EntitySystem } from "../ecs/System";
import type { Entity } from "../ecs/Entity";
import { EventComponent } from "./components";

type Cell = { filled: boolean; color: string };

export class GridRendererSystem extends TickSystem {
    private readonly ctx: CanvasRenderingContext2D;
    private cells: Cell[][];
    private width: number;
    private height: number;
    private padding: number;
    private radius: number;

    constructor(canvas: HTMLCanvasElement, gridX = 10, gridY = 10, padding = 6, radius = 6) {
        super();
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context not available");
        this.ctx = ctx;
        this.width = gridX;
        this.height = gridY;
        this.padding = padding;
        this.radius = radius;
        this.cells = Array.from({ length: this.height }, () =>
            Array.from({ length: this.width }, () => ({ filled: false, color: "#2ecc71" }))
        );
        // Make canvas resize friendly
        const resize = () => {
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            canvas.width = Math.max(1, Math.floor(rect.width * dpr));
            canvas.height = Math.max(1, Math.floor(rect.height * dpr));
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resize();
        window.addEventListener("resize", resize);
    }

    update(_dt: number): void {
        this.render();
    }

    onEntityAdded(entity: Entity): void {
        const ev = entity.getComponent(EventComponent);
        if (!ev) return;
        if (ev.type === "grid:set" || ev.type === "grid:toggle") {
            const { x, y, filled, color } = ev.payload as any;
            if (typeof x === "number" && typeof y === "number") {
                if (ev.type === "grid:set") this.setCell(x, y, !!filled, color);
                else if (ev.type === "grid:toggle") this.toggleCell(x, y, color);
            }
        } else if (ev.type === "level:loaded") {
            const data = ev.payload?.data as any;
            // support flexible level shape: look for grid.width/height
            const gw = data?.grid?.width ?? data?.width ?? this.width;
            const gh = data?.grid?.height ?? data?.height ?? this.height;
            this.resizeGrid(gw, gh);
            // optional: populate a demo pattern if provided
            if (data?.seed) this.randomFill(data.seed);
            else if (data?.pattern === "checker") this.fillChecker();
            else if (Array.isArray(data?.cells)) this.applyCellsArray(data.cells);
        }
    }

    onEntityRemoved(_entity: Entity): void {
        // no-op
    }

    setCell(x: number, y: number, filled: boolean, color?: string) {
        if (y < 0 || y >= this.cells.length) return;
        if (x < 0 || x >= this.cells[0].length) return;
        this.cells[y][x].filled = filled;
        if (color) this.cells[y][x].color = color;
    }

    toggleCell(x: number, y: number, color?: string) {
        if (y < 0 || y >= this.cells.length) return;
        if (x < 0 || x >= this.cells[0].length) return;
        this.cells[y][x].filled = !this.cells[y][x].filled;
        if (color) this.cells[y][x].color = color;
    }

    private resizeGrid(newW: number, newH: number) {
        this.width = Math.max(1, Math.floor(newW));
        this.height = Math.max(1, Math.floor(newH));
        this.cells.length = 0;
        for (let r = 0; r < this.height; r++) {
            const row: Cell[] = [];
            for (let c = 0; c < this.width; c++) row.push({ filled: false, color: "#2ecc71" });
            this.cells.push(row);
        }
    }

    private fillChecker() {
        for (let r = 0; r < this.height; r++) {
            for (let c = 0; c < this.width; c++) {
                this.cells[r][c].filled = ((r + c) % 2) === 0;
                this.cells[r][c].color = (this.cells[r][c].filled ? "#3498db" : "#e74c3c");
            }
        }
    }

    private randomFill(seed?: any) {
        const rnd = (() => {
            let s = typeof seed === "number" ? seed : Date.now();
            return () => {
                s = (s * 9301 + 49297) % 233280;
                return s / 233280;
            };
        })();
        for (let r = 0; r < this.height; r++) {
            for (let c = 0; c < this.width; c++) {
                this.cells[r][c].filled = rnd() > 0.6;
                this.cells[r][c].color = this.cells[r][c].filled ? "#9b59b6" : "#ecf0f1";
            }
        }
    }

    private applyCellsArray(arr: any[]) {
        // expects array of {x,y,filled,color}
        for (const it of arr) {
            const x = it.x, y = it.y;
            if (typeof x === "number" && typeof y === "number") {
                if (y >= 0 && y < this.height && x >= 0 && x < this.width) {
                    this.cells[y][x].filled = !!it.filled;
                    if (it.color) this.cells[y][x].color = it.color;
                }
            }
        }
    }

    private render() {
        const ctx = this.ctx;
        const canvas = ctx.canvas;
        const w = canvas.clientWidth || canvas.width;
        const h = canvas.clientHeight || canvas.height;
        ctx.clearRect(0, 0, w, h);

        const cols = this.width;
        const rows = this.height;
        const pad = this.padding;

        const totalPadX = pad * (cols + 1);
        const totalPadY = pad * (rows + 1);
        const cellW = Math.max(4, (w - totalPadX) / cols);
        const cellH = Math.max(4, (h - totalPadY) / rows);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = this.cells[r][c];
                const x = pad + c * (cellW + pad);
                const y = pad + r * (cellH + pad);
                // draw background rect (light stroke)
                ctx.beginPath();
                this.roundRect(ctx, x, y, cellW, cellH, this.radius);
                ctx.strokeStyle = "#222";
                ctx.lineWidth = 1;
                ctx.stroke();
                if (cell.filled) {
                    ctx.fillStyle = cell.color;
                    ctx.fill();
                }
            }
        }
    }

    private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
        const radius = Math.min(r, w / 2, h / 2);
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + w, y, x + w, y + h, radius);
        ctx.arcTo(x + w, y + h, x, y + h, radius);
        ctx.arcTo(x, y + h, x, y, radius);
        ctx.arcTo(x, y, x + w, y, radius);
        ctx.closePath();
    }
}

export default GridRendererSystem;
