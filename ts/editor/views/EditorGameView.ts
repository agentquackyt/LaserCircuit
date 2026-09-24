import type { UserLevelDraft } from "../CommunityLevelTypes";
import { rotatePiece, type Direction, type LightColor } from "../../utils/LaserLogic";
import GridRendererSystem from "../../systems/GridRendererSystem";
import { View } from "../../utils/View";

export type EditorTool = "select" | "erase" | "obstacle" | "emitter" | "target" | "mirror" | "splitter";
export type PieceOrientation = "/" | "\\" | "horizontal" | "vertical";
type HoveredCell = { x: number; y: number } | null;

const DIRECTIONS: Direction[] = ["up", "right", "down", "left"];

export class EditorGameView extends View {
    private readonly canvas: HTMLCanvasElement;
    private readonly renderer: GridRendererSystem;
    private level: UserLevelDraft;
    private tool: EditorTool = "select";
    private color: LightColor = "red";
    private direction: Direction = "right";
    private orientation: PieceOrientation = "/";
    private rotatable = true;
    private hoveredCell: HoveredCell = null;
    private readonly simulating = true;

    constructor(level: UserLevelDraft) {
        const canvas = document.createElement("canvas");
        canvas.className = "community-editor-board";
        canvas.width = 720;
        canvas.height = 720;
        super(canvas);
        this.canvas = canvas;
        this.level = level;
        this.renderer = new GridRendererSystem(canvas, level.document.grid?.width ?? 9, level.document.grid?.height ?? 9, 6, 6);
        this.renderer.setSimulationEnabled(true);
        this.renderer.setLevelData(level.document);
        canvas.addEventListener("mousemove", (event) => {
            this.hoveredCell = this.getCell(event);
        });
        canvas.addEventListener("mouseleave", () => {
            this.hoveredCell = null;
        });
        canvas.addEventListener("mousedown", (event) => {
            event.preventDefault();
            this.applyAction(this.getCell(event), event.button === 2 || event.button === 1);
        });
        canvas.addEventListener("contextmenu", (event) => event.preventDefault());
        requestAnimationFrame(() => this.renderer.refresh());
    }

    setLevel(level: UserLevelDraft): void {
        this.level = level;
        this.renderer.setLevelData(level.document);
        this.renderer.setSimulationEnabled(this.simulating);
    }

    setTool(tool: EditorTool): void {
        this.tool = tool;
        if (tool === "splitter" && (this.orientation !== "horizontal" && this.orientation !== "vertical")) {
            this.orientation = "horizontal";
        }
        if (tool === "mirror" && (this.orientation !== "/" && this.orientation !== "\\")) {
            this.orientation = "/";
        }
    }
    setColor(color: LightColor): void { this.color = color; }
    setDirection(direction: Direction): void { this.direction = direction; }
    setOrientation(orientation: PieceOrientation): void { this.orientation = orientation; }
    setRotatable(rotatable: boolean): void { this.rotatable = rotatable; }

    clear(): void {
        this.level.document.emitters = [];
        this.level.document.targets = [];
        this.level.document.pieces = [];
        this.emitChanged();
    }

    deleteHovered(): void {
        if (!this.hoveredCell) return;
        this.clearCell(this.hoveredCell.x, this.hoveredCell.y);
        this.emitChanged();
    }

    rotateHovered(): void {
        if (!this.hoveredCell) return;
        const { x, y } = this.hoveredCell;
        const emitter = this.level.document.emitters?.find((item) => item.x === x && item.y === y);
        if (emitter) emitter.dir = DIRECTIONS[(DIRECTIONS.indexOf(emitter.dir) + 1) % DIRECTIONS.length] ?? "right";
        const piece = this.level.document.pieces?.find((item) => item.x === x && item.y === y);
        if (piece && piece.type !== "obstacle") {
            const rotated = rotatePiece(piece);
            this.level.document.pieces = this.level.document.pieces?.map((item) => item === piece ? rotated : item);
        }
        this.emitChanged();
    }

    private getCell(event: MouseEvent): HoveredCell {
        const rect = this.canvas.getBoundingClientRect();
        return this.renderer.getCellAt(event.clientX - rect.left, event.clientY - rect.top) ?? null;
    }

    private applyAction(cell: HoveredCell, alternateAction: boolean): void {
        if (!cell) return;
        if (alternateAction || this.tool === "select") {
            this.hoveredCell = cell;
            this.rotateHovered();
            return;
        }
        if (this.tool === "erase") {
            this.clearCell(cell.x, cell.y);
            this.emitChanged();
            return;
        }

        this.clearCell(cell.x, cell.y);
        const { x, y } = cell;
        if (this.tool === "emitter") this.level.document.emitters?.push({ x, y, dir: this.direction, color: this.color });
        if (this.tool === "target") this.level.document.targets?.push({ x, y, color: this.color });
        if (this.tool === "obstacle") this.level.document.pieces?.push({ type: "obstacle", x, y });
        if (this.tool === "mirror" && (this.orientation === "/" || this.orientation === "\\")) {
            this.level.document.pieces?.push({ type: "mirror", x, y, orientation: this.orientation, rotatable: this.rotatable });
        }
        if (this.tool === "splitter" && (this.orientation === "horizontal" || this.orientation === "vertical")) {
            this.level.document.pieces?.push({ type: "splitter", x, y, orientation: this.orientation, dir: this.direction, rotatable: this.rotatable });
        }
        this.emitChanged();
    }

    private clearCell(x: number, y: number): void {
        this.level.document.emitters = (this.level.document.emitters ?? []).filter((item) => item.x !== x || item.y !== y);
        this.level.document.targets = (this.level.document.targets ?? []).filter((item) => item.x !== x || item.y !== y);
        this.level.document.pieces = (this.level.document.pieces ?? []).filter((item) => item.x !== x || item.y !== y);
    }

    private emitChanged(): void {
        this.renderer.setLevelData(this.level.document);
        this.renderer.setSimulationEnabled(this.simulating);
        this.invokeTrigger("changed", this.level);
    }
}
