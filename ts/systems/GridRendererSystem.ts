import { TickSystem } from "../ecs/System";
import type { Entity } from "../ecs/Entity";
import { EventComponent } from "./components";
import {
	simulateLaserLevel,
	rotatePiece,
	type AdderPiece,
	type Emitter,
	type LaserLevelData,
	type LaserPiece,
	type LaserSimulationResult,
	type LightColor,
	type MirrorPiece,
	type SplitterPiece,
	type Target,
} from "../utils/LaserLogic";

const DEFAULT_GRID_SIZE = 9;
const PIECE_COLOR = "#2f3640";

type GridLayout = {
	originX: number;
	originY: number;
	cellW: number;
	cellH: number;
};

export class GridRendererSystem extends TickSystem {
	private readonly ctx: CanvasRenderingContext2D;
	private width: number;
	private height: number;
	private padding: number;
	private radius: number;
	private layout: GridLayout = { originX: 0, originY: 0, cellW: 0, cellH: 0 };
	private statusEl = document.querySelector("#status") as HTMLElement | null;

	private emitters: Emitter[] = [];
	private targets: Target[] = [];
	private pieces: LaserPiece[] = [];
	private simulation?: LaserSimulationResult;
	private dirty = true;

	constructor(canvas: HTMLCanvasElement, gridX = DEFAULT_GRID_SIZE, gridY = DEFAULT_GRID_SIZE, padding = 6, radius = 6) {
		super();
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Canvas 2D context not available");
		this.ctx = ctx;
		this.width = gridX;
		this.height = gridY;
		this.padding = padding;
		this.radius = radius;

		const resize = () => {
			const dpr = window.devicePixelRatio || 1;
			const rect = canvas.getBoundingClientRect();
			canvas.width = Math.max(1, Math.floor(rect.width * dpr));
			canvas.height = Math.max(1, Math.floor(rect.height * dpr));
			this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			this.dirty = true;
		};
		resize();
		window.addEventListener("resize", resize);
	}

	update(_dt: number): void {
		if (this.dirty) this.recompute();
		this.render();
	}

	onEntityAdded(entity: Entity): void {
		const ev = entity.getComponent(EventComponent);
		if (!ev) return;
		if (ev.type === "level:loaded") {
			this.applyLevelData(ev.payload?.data as LaserLevelData);
			return;
		}
		if (ev.type === "canvas:click") {
			this.handleCanvasClick(ev.payload?.canvasX, ev.payload?.canvasY);
		}
	}

	onEntityRemoved(_entity: Entity): void {}

	private applyLevelData(data?: LaserLevelData) {
		this.width = Math.max(1, Math.floor(data?.grid?.width ?? DEFAULT_GRID_SIZE));
		this.height = Math.max(1, Math.floor(data?.grid?.height ?? DEFAULT_GRID_SIZE));
		this.emitters = Array.isArray(data?.emitters) ? data!.emitters : [];
		this.targets = Array.isArray(data?.targets) ? data!.targets : [];
		this.pieces = Array.isArray(data?.pieces) ? data!.pieces : [];
		this.dirty = true;
	}

	private recompute() {
		this.simulation = simulateLaserLevel(this.width, this.height, this.emitters, this.pieces, this.targets);
		this.dirty = false;
		this.updateStatus();
	}

	private updateStatus() {
		if (!this.statusEl) return;
		if (!this.simulation) {
			this.statusEl.textContent = "Loading level...";
			return;
		}
		const matched = this.simulation.targetHits.filter(Boolean).length;
		const total = this.targets.length;
		this.statusEl.textContent = this.simulation.solved
			? `Solved! ${matched}/${total} targets lit correctly.`
			: `Aim lasers: ${matched}/${total} targets correct.`;
	}

	private handleCanvasClick(canvasX?: number, canvasY?: number) {
		if (typeof canvasX !== "number" || typeof canvasY !== "number") return;
		const cell = this.canvasToCell(canvasX, canvasY);
		if (!cell) return;
		const idx = this.pieces.findIndex((piece) => piece.x === cell.x && piece.y === cell.y && piece.rotatable !== false);
		if (idx < 0) return;
		const piece = this.pieces[idx];
		if (!piece) return;
		this.pieces[idx] = rotatePiece(piece);
		this.dirty = true;
	}

	private canvasToCell(canvasX: number, canvasY: number): { x: number; y: number } | undefined {
		const { originX, originY, cellW, cellH } = this.layout;
		if (cellW <= 0 || cellH <= 0) return undefined;
		for (let y = 0; y < this.height; y++) {
			for (let x = 0; x < this.width; x++) {
				const px = originX + this.padding + x * (cellW + this.padding);
				const py = originY + this.padding + y * (cellH + this.padding);
				if (canvasX >= px && canvasX <= px + cellW && canvasY >= py && canvasY <= py + cellH) {
					return { x, y };
				}
			}
		}
		return undefined;
	}

	private render() {
		const ctx = this.ctx;
		const canvas = ctx.canvas;
		const w = canvas.clientWidth || canvas.width;
		const h = canvas.clientHeight || canvas.height;
		ctx.clearRect(0, 0, w, h);

		const cols = this.width;
		const rows = this.height;
		const totalPadX = this.padding * (cols + 1);
		const totalPadY = this.padding * (rows + 1);
		const cellW = Math.max(4, (w - totalPadX) / cols);
		const cellH = Math.max(4, (h - totalPadY) / rows);
		const gridW = cols * cellW + (cols + 1) * this.padding;
		const gridH = rows * cellH + (rows + 1) * this.padding;
		const originX = Math.max(0, (w - gridW) / 2);
		const originY = Math.max(0, (h - gridH) / 2);

		this.layout = { originX, originY, cellW, cellH };

		for (let y = 0; y < rows; y++) {
			for (let x = 0; x < cols; x++) {
				const px = originX + this.padding + x * (cellW + this.padding);
				const py = originY + this.padding + y * (cellH + this.padding);
				ctx.beginPath();
				this.roundRect(ctx, px, py, cellW, cellH, this.radius);
				ctx.strokeStyle = "#dcdde1";
				ctx.lineWidth = 1;
				ctx.stroke();
			}
		}

		this.renderTargets(originX, originY, cellW, cellH);
		this.renderPieces(originX, originY, cellW, cellH);
		this.renderEmitters(originX, originY, cellW, cellH);
		this.renderBeams(originX, originY, cellW, cellH);
	}

	private renderBeams(originX: number, originY: number, cellW: number, cellH: number) {
		if (!this.simulation) return;
		const ctx = this.ctx;
		ctx.lineWidth = 4;
		ctx.globalAlpha = 0.85;
		for (const segment of this.simulation.segments) {
			ctx.beginPath();
			ctx.strokeStyle = this.toCssColor(segment.color);
			ctx.moveTo(this.centerX(segment.x1, originX, cellW), this.centerY(segment.y1, originY, cellH));
			ctx.lineTo(this.centerX(segment.x2, originX, cellW), this.centerY(segment.y2, originY, cellH));
			ctx.stroke();
		}
		ctx.globalAlpha = 1;
	}

	private renderPieces(originX: number, originY: number, cellW: number, cellH: number) {
		const ctx = this.ctx;
		ctx.font = `${Math.max(12, Math.floor(Math.min(cellW, cellH) * 0.45))}px sans-serif`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";

		for (const piece of this.pieces) {
			const cx = this.centerX(piece.x, originX, cellW);
			const cy = this.centerY(piece.y, originY, cellH);
			ctx.fillStyle = PIECE_COLOR;
			if (piece.type === "mirror") {
				ctx.fillText(piece.orientation, cx, cy);
			} else if (piece.type === "splitter") {
				ctx.fillText(piece.orientation === "horizontal" ? "⇆" : "⇅", cx, cy);
			} else {
				ctx.fillText(this.dirSymbol(piece.dir), cx, cy);
				ctx.beginPath();
				ctx.strokeStyle = "#8e44ad";
				ctx.lineWidth = 2;
				ctx.arc(cx, cy, Math.min(cellW, cellH) * 0.28, 0, Math.PI * 2);
				ctx.stroke();
			}
		}
	}

	private renderEmitters(originX: number, originY: number, cellW: number, cellH: number) {
		const ctx = this.ctx;
		for (const emitter of this.emitters) {
			const cx = this.centerX(emitter.x, originX, cellW);
			const cy = this.centerY(emitter.y, originY, cellH);
			ctx.fillStyle = this.toCssColor(emitter.color);
			ctx.beginPath();
			ctx.arc(cx, cy, Math.min(cellW, cellH) * 0.2, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = "#2f3640";
			ctx.font = `${Math.max(10, Math.floor(Math.min(cellW, cellH) * 0.3))}px sans-serif`;
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(this.dirSymbol(emitter.dir), cx, cy + Math.min(cellW, cellH) * 0.35);
		}
	}

	private renderTargets(originX: number, originY: number, cellW: number, cellH: number) {
		const ctx = this.ctx;
		for (const target of this.targets) {
			const x = originX + this.padding + target.x * (cellW + this.padding);
			const y = originY + this.padding + target.y * (cellH + this.padding);
			const colorSeen = this.simulation?.targetColors.get(`${target.x},${target.y}`);
			const hit = colorSeen === target.color;
			ctx.beginPath();
			ctx.strokeStyle = this.toCssColor(target.color);
			ctx.lineWidth = hit ? 4 : 2;
			ctx.strokeRect(x + 2, y + 2, cellW - 4, cellH - 4);
			if (colorSeen) {
				ctx.fillStyle = this.toCssColor(colorSeen);
				ctx.globalAlpha = hit ? 0.35 : 0.2;
				ctx.fillRect(x + 4, y + 4, cellW - 8, cellH - 8);
				ctx.globalAlpha = 1;
			}
		}
	}

	private centerX(x: number, originX: number, cellW: number): number {
		return originX + this.padding + x * (cellW + this.padding) + cellW / 2;
	}

	private centerY(y: number, originY: number, cellH: number): number {
		return originY + this.padding + y * (cellH + this.padding) + cellH / 2;
	}

	private dirSymbol(dir: AdderPiece["dir"]): string {
		if (dir === "up") return "↑";
		if (dir === "right") return "→";
		if (dir === "down") return "↓";
		return "←";
	}

	private toCssColor(color: LightColor): string {
		if (color === "red") return "#e74c3c";
		if (color === "blue") return "#3498db";
		return "#9b59b6";
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
