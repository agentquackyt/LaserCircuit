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
const DEFAULT_BLOCK_CYCLE: Array<LaserPiece | null> = [
	null,
	{ type: "mirror", x: 0, y: 0, orientation: "/", rotatable: true },
	{ type: "mirror", x: 0, y: 0, orientation: "\\", rotatable: true },
	{ type: "splitter", x: 0, y: 0, orientation: "horizontal", rotatable: true },
	{ type: "splitter", x: 0, y: 0, orientation: "vertical", rotatable: true },
];

type GridLayout = {
	originX: number;
	originY: number;
	cellW: number;
	cellH: number;
};

export class GridRendererSystem extends TickSystem {
	private readonly ctx: CanvasRenderingContext2D;
	private readonly canvas: HTMLCanvasElement;
	private width: number;
	private height: number;
	private padding: number;
	private radius: number;
	private layout: GridLayout = { originX: 0, originY: 0, cellW: 0, cellH: 0 };
	private statusEl = document.querySelector("#status") as HTMLElement | null;
	private completeButton = document.querySelector("#complete-level-btn") as HTMLButtonElement | null;
	private completionDialog = document.querySelector("#completion-dialog") as HTMLDialogElement | null;
	private completionTimeEl = document.querySelector("#completion-time") as HTMLElement | null;
	private canPlaceOwnBlocks = false;
	private blockCycle: Array<LaserPiece | null> = DEFAULT_BLOCK_CYCLE;
	private levelPieceCells = new Set<string>();

	private emitters: Emitter[] = [];
	private targets: Target[] = [];
	private pieces: LaserPiece[] = [];
	private simulation?: LaserSimulationResult;
	private dirty = true;
	private levelStartedAt = 0;

	constructor(canvas: HTMLCanvasElement, gridX = DEFAULT_GRID_SIZE, gridY = DEFAULT_GRID_SIZE, padding = 6, radius = 6) {
		super();
		this.canvas = canvas;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Canvas 2D context not available");
		this.ctx = ctx;
		this.width = gridX;
		this.height = gridY;
		this.padding = padding;
		this.radius = radius;
		this.completeButton?.addEventListener("click", () => this.showCompletionDialog());

		const resize = () => {
			this.resize();
		};
		resize();
		window.addEventListener("resize", resize);
	}

	resize(): void {
		const dpr = window.devicePixelRatio || 1;
		const rect = this.canvas.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return;
		const nextWidth = Math.max(1, Math.floor(rect.width * dpr));
		const nextHeight = Math.max(1, Math.floor(rect.height * dpr));
		if (this.canvas.width === nextWidth && this.canvas.height === nextHeight) return;
		this.canvas.width = nextWidth;
		this.canvas.height = nextHeight;
		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		this.dirty = true;
	}

	update(_dt: number): void {
		this.resize();
		if (this.canvas.clientWidth <= 0 || this.canvas.clientHeight <= 0) return;
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
			this.handleCanvasClick(ev.payload?.canvasX, ev.payload?.canvasY, ev.payload?.button);
		}
	}

	onEntityRemoved(_entity: Entity): void { }

	private applyLevelData(data?: LaserLevelData) {
		this.width = Math.max(1, Math.floor(data?.grid?.width ?? DEFAULT_GRID_SIZE));
		this.height = Math.max(1, Math.floor(data?.grid?.height ?? DEFAULT_GRID_SIZE));
		this.emitters = Array.isArray(data?.emitters) ? data!.emitters : [];
		this.targets = Array.isArray(data?.targets) ? data!.targets : [];
		this.pieces = Array.isArray(data?.pieces) ? data!.pieces.map((piece) => this.normalizePiece(piece)).filter(Boolean) as LaserPiece[] : [];
		this.levelPieceCells = new Set(this.pieces.map((piece) => this.cellKey(piece.x, piece.y)));
		this.canPlaceOwnBlocks = Boolean(data?.rules?.canPlaceOwnBlocks);
		this.blockCycle = this.normalizeBlockCycle(data?.rules?.blockCycle);
		this.levelStartedAt = performance.now();
		if (this.completeButton) this.completeButton.classList.add("hidden");
		this.dirty = true;
	}

	private normalizePiece(piece: LaserPiece): LaserPiece | null {
		if (piece.type === "mixer") {
			return { type: "splitter", x: piece.x, y: piece.y, orientation: "horizontal", rotatable: piece.rotatable };
		}
		return piece;
	}

	private normalizeBlockCycle(cycle?: Array<LaserPiece | null>): Array<LaserPiece | null> {
		if (!cycle || cycle.length === 0) return DEFAULT_BLOCK_CYCLE;
		const normalized = cycle
			.map((entry) => (entry ? this.normalizePiece(entry) : null));
		return normalized.length > 0 ? normalized : DEFAULT_BLOCK_CYCLE;
	}

	private recompute() {
		this.simulation = simulateLaserLevel(this.width, this.height, this.emitters, this.pieces, this.targets);
		this.dirty = false;
		this.updateStatus();
	}

	private updateStatus() {
		if (!this.simulation) {
			if (this.statusEl) this.statusEl.textContent = "Loading level...";
			return;
		}
		const matched = this.simulation.targetHits.filter(Boolean).length;
		const total = this.targets.length;
		const solved = this.simulation.solved;
		if (this.statusEl) {
			this.statusEl.textContent = solved
				? `Solved! ${matched}/${total} targets lit correctly.`
				: `Aim lasers: ${matched}/${total} targets correct.`;
		}
		if (this.completeButton) this.completeButton.classList.toggle("hidden", !solved);
	}

	private showCompletionDialog() {
		if (!this.simulation?.solved || !this.completionDialog) return;
		const elapsedSeconds = Math.max(0, Math.round((performance.now() - this.levelStartedAt) / 1000));
		if (this.completionTimeEl) this.completionTimeEl.textContent = String(elapsedSeconds);
		if (!this.completionDialog.open) this.completionDialog.showModal();
	}

	private handleCanvasClick(canvasX?: number, canvasY?: number, button = 0) {
		if (typeof canvasX !== "number" || typeof canvasY !== "number") return;
		const cell = this.canvasToCell(canvasX, canvasY);
		if (!cell) return;
		if (this.canPlaceOwnBlocks && button === 0) {
			this.cycleCell(cell.x, cell.y);
			return;
		}
		const idx = this.pieces.findIndex((piece) => piece.x === cell.x && piece.y === cell.y && piece.rotatable !== false);
		if (idx < 0) return;
		const piece = this.pieces[idx];
		if (!piece) return;
		this.pieces[idx] = rotatePiece(piece);
		this.dirty = true;
	}

	private cycleCell(x: number, y: number) {
		const currentIndex = this.pieces.findIndex((piece) => piece.x === x && piece.y === y);
		const current = currentIndex >= 0 ? this.pieces[currentIndex] : undefined;
		const isLevelPiece = this.levelPieceCells.has(this.cellKey(x, y));
		const next = this.nextCyclePiece(current, x, y, isLevelPiece);
		if (!next) {
			if (currentIndex >= 0) this.pieces.splice(currentIndex, 1);
			this.dirty = true;
			return;
		}
		if (currentIndex >= 0) this.pieces[currentIndex] = next;
		else this.pieces.push(next);
		this.dirty = true;
	}

	private nextCyclePiece(current: LaserPiece | undefined, x: number, y: number, isLevelPiece: boolean): LaserPiece | null {
		const cycle = this.blockCycle.length > 0 ? this.blockCycle : DEFAULT_BLOCK_CYCLE;
		if (cycle.length === 0) return null;
		const currentKey = this.cycleKey(current);
		let index = cycle.findIndex((entry) => this.cycleKey(entry) === currentKey);
		if (index < 0) {
			index = cycle.findIndex((entry) => entry !== null);
			if (index < 0) return null;
		} else {
			index = (index + 1) % cycle.length;
			while (isLevelPiece && cycle[index] === null) {
				index = (index + 1) % cycle.length;
			}
		}
		const entry = cycle[index];
		if (!entry) return null;
		return { ...entry, x, y };
	}

	private cellKey(x: number, y: number): string {
		return `${x},${y}`;
	}

	private cycleKey(piece?: LaserPiece | null): string {
		if (!piece) return "none";
		if (piece.type === "mirror") return `mirror:${piece.orientation}`;
		if (piece.type === "splitter") return `splitter:${piece.orientation}`;
		if (piece.type === "adder") return `adder:${piece.dir}`;
		return "splitter:horizontal";
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
		if (w <= 0 || h <= 0) return;

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
		this.renderBoardFrame(originX, originY, gridW, gridH);

		for (let y = 0; y < rows; y++) {
			for (let x = 0; x < cols; x++) {
				const px = originX + this.padding + x * (cellW + this.padding);
				const py = originY + this.padding + y * (cellH + this.padding);
				ctx.beginPath();
				this.roundRect(ctx, px, py, cellW, cellH, this.radius);
				ctx.fillStyle = "#424956";
				ctx.fill();
				ctx.strokeStyle = "rgba(255,255,255,0.10)";
				ctx.lineWidth = 1;
				ctx.stroke();
			}
		}

		this.renderBeams(originX, originY, cellW, cellH);
		this.renderTargets(originX, originY, cellW, cellH);
		this.renderPieces(originX, originY, cellW, cellH);
		this.renderEmitters(originX, originY, cellW, cellH);
	}

	private renderBoardFrame(originX: number, originY: number, gridW: number, gridH: number) {
		const ctx = this.ctx;
		const frameInset = 14;
		const frameRadius = Math.min(22, Math.min(gridW, gridH) * 0.06);
		ctx.save();
		ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
		ctx.shadowBlur = 28;
		ctx.shadowOffsetY = 12;
		ctx.fillStyle = "#2b313c";
		ctx.beginPath();
		this.roundRect(ctx, originX - frameInset, originY - frameInset, gridW + frameInset * 2, gridH + frameInset * 2, frameRadius);
		ctx.fill();
		ctx.restore();

		ctx.save();
		ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
		ctx.lineWidth = 1;
		ctx.beginPath();
		this.roundRect(ctx, originX - frameInset + 1, originY - frameInset + 1, gridW + frameInset * 2 - 2, gridH + frameInset * 2 - 2, frameRadius - 1);
		ctx.stroke();
		ctx.restore();
	}

	private renderBeams(originX: number, originY: number, cellW: number, cellH: number) {
		if (!this.simulation) return;
		const ctx = this.ctx;
		const mixBySegment = new Map<string, { x1: number; y1: number; x2: number; y2: number; mask: number; count: number }>();
		for (const segment of this.simulation.segments) {
			// Keep direction in the segment key so opposite-traveling beams do not
			// incorrectly blend into a single color on the same edge.
			const key = `${segment.x1},${segment.y1},${segment.x2},${segment.y2}`;
			const existing = mixBySegment.get(key);
			if (existing) {
				existing.mask |= this.lightColorMask(segment.color);
				existing.count += 1;
				continue;
			}
			mixBySegment.set(key, {
				x1: segment.x1,
				y1: segment.y1,
				x2: segment.x2,
				y2: segment.y2,
				mask: this.lightColorMask(segment.color),
				count: 1,
			});
		}

		const coreWidth = Math.max(2.2, Math.min(cellW, cellH) * 0.13);
		ctx.save();
		ctx.lineCap = "round";
		for (const mixed of mixBySegment.values()) {
			const x1 = this.centerX(mixed.x1, originX, cellW);
			const y1 = this.centerY(mixed.y1, originY, cellH);
			const x2 = this.centerX(mixed.x2, originX, cellW);
			const y2 = this.centerY(mixed.y2, originY, cellH);
			const color = this.maskToBeamColor(mixed.mask);
			const intensity = Math.min(1, 0.62 + (mixed.count - 1) * 0.1);

			ctx.strokeStyle = color;
			ctx.globalAlpha = 0.1 * intensity;
			ctx.lineWidth = coreWidth * 2.8;
			ctx.beginPath();
			ctx.moveTo(x1, y1);
			ctx.lineTo(x2, y2);
			ctx.stroke();

			ctx.globalAlpha = 0.34 * intensity;
			ctx.lineWidth = coreWidth * 1.7;
			ctx.beginPath();
			ctx.moveTo(x1, y1);
			ctx.lineTo(x2, y2);
			ctx.stroke();

			ctx.globalAlpha = 0.92;
			ctx.lineWidth = coreWidth;
			ctx.beginPath();
			ctx.moveTo(x1, y1);
			ctx.lineTo(x2, y2);
			ctx.stroke();
		}
		ctx.restore();
	}

	private renderPieces(originX: number, originY: number, cellW: number, cellH: number) {
		const ctx = this.ctx;
		ctx.font = `700 ${Math.max(16, Math.floor(Math.min(cellW, cellH) * 0.72))}px "Consolas", "Courier New", monospace`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";

		for (const piece of this.pieces) {
			const cx = this.centerX(piece.x, originX, cellW);
			const cy = this.centerY(piece.y, originY, cellH);
			const accent = this.pieceAccentColor(piece);
			const glyph = this.pieceGlyph(piece);
			
			ctx.fillStyle = accent;
			ctx.fillText(glyph, cx, cy + 1);

			if (piece.type === "adder") {
				ctx.shadowBlur = 0;
				ctx.fillStyle = "rgba(255,255,255,0.82)";
				ctx.font = `700 ${Math.max(10, Math.floor(Math.min(cellW, cellH) * 0.22))}px "Consolas", "Courier New", monospace`;
				ctx.fillText(this.dirSymbol(piece.dir), cx + cellW * 0.18, cy - cellH * 0.16);
				ctx.font = `700 ${Math.max(16, Math.floor(Math.min(cellW, cellH) * 0.72))}px "Consolas", "Courier New", monospace`;
			}
			ctx.restore();
		}
	}

	private renderEmitters(originX: number, originY: number, cellW: number, cellH: number) {
		const ctx = this.ctx;
		for (const emitter of this.emitters) {
			const cx = this.centerX(emitter.x, originX, cellW);
			const cy = this.centerY(emitter.y, originY, cellH);
			ctx.save();
			ctx.shadowColor = this.toCssColor(emitter.color);
			ctx.shadowBlur = 5;
			ctx.fillStyle = this.toCssColor(emitter.color);
			ctx.beginPath();
			this.roundRect(ctx, cx - cellW * 0.4, cy - cellH * 0.4, cellW * 0.8, cellH * 0.8, Math.min(cellW, cellH) * 0.2);
			ctx.fill();
			ctx.shadowBlur = 0;
			ctx.strokeStyle = "rgba(255,255,255,0.45)";
			ctx.lineWidth = 1.5;
			ctx.stroke();
			ctx.fillStyle = "#dbdbdb";
			ctx.font = `${Math.max(20, Math.floor(Math.min(cellW, cellH) * 0.5))}px "Google Sans", sans-serif`;
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(this.dirSymbol(emitter.dir), cx, cy + 1);
			ctx.restore();
		}
	}

	private renderTargets(originX: number, originY: number, cellW: number, cellH: number) {
		const ctx = this.ctx;
		for (const target of this.targets) {
			const x = originX + this.padding + target.x * (cellW + this.padding);
			const y = originY + this.padding + target.y * (cellH + this.padding);
			const colorSeen = this.simulation?.targetColors.get(`${target.x},${target.y}`);
			const hit = colorSeen === target.color;
			ctx.save();
			ctx.shadowColor = this.toCssColor(target.color);
			ctx.shadowBlur = hit ? 16 : 8;
			ctx.fillStyle = colorSeen ? this.toCssColor(colorSeen) : "#262c35";
			ctx.globalAlpha = colorSeen ? (hit ? 0.28 : 0.16) : 0.96;
			this.roundRect(ctx, x + 4, y + 4, cellW - 8, cellH - 8, Math.min(cellW, cellH) * 0.15);
			ctx.fill();
			ctx.globalAlpha = 1;
			ctx.strokeStyle = this.toCssColor(target.color);
			ctx.lineWidth = hit ? 3 : 2;
			ctx.stroke();
			ctx.fillStyle = this.toCssColor(target.color);
			ctx.beginPath();
			ctx.arc(x + cellW / 2, y + cellH / 2, Math.min(cellW, cellH) * 0.12, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
		}
	}

	private lightColorMask(color: LightColor): number {
		if (color === "red") return 1;
		if (color === "green") return 2;
		if (color === "yellow") return 3;
		if (color === "blue") return 4;
		if (color === "purple") return 5;
		if (color === "cyan") return 6;
		return 7;
	}

	private maskToBeamColor(mask: number): string {
		if (mask === 1) return "#ff4b4b";
		if (mask === 2) return "#4dff88";
		if (mask === 3) return "#ffe45c";
		if (mask === 4) return "#4da3ff";
		if (mask === 5) return "#d56bff";
		if (mask === 6) return "#62f5ff";
		return "#ffffff";
	}

	private pieceGlyph(piece: LaserPiece): string {
		if (piece.type === "mirror") return piece.orientation;
		if (piece.type === "splitter") return "+";
		return "#";
	}

	private pieceAccentColor(piece: LaserPiece): string {
		if (piece.type === "mirror") return "#68a9ff";
		if (piece.type === "splitter") return "#58ffd0" ;
		return "#ffffff";
	}


	private centerX(x: number, originX: number, cellW: number): number {
		return originX + this.padding + x * (cellW + this.padding) + cellW / 2;
	}

	private centerY(y: number, originY: number, cellH: number): number {
		return originY + this.padding + y * (cellH + this.padding) + cellH / 2;
	}

	private dirSymbol(dir: AdderPiece["dir"]): string {
		if (dir === "up") return "⇧";
		if (dir === "right") return "⇨";
		if (dir === "down") return "⇩";
		return "⇦";
	}

	private toCssColor(color: LightColor): string {
		if (color === "red") return "#ff4b4b";
		if (color === "green") return "#4dff88";
		if (color === "blue") return "#4da3ff";
		if (color === "yellow") return "#ffe45c";
		if (color === "cyan") return "#62f5ff";
		if (color === "white") return "#ffffff";
		return "#d56bff";
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
