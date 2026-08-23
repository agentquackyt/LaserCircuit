import { TickSystem } from "../ecs/System";
import { Entity } from "../ecs/Entity";
import { EventComponent, UIEventComponent, CanvasEventComponent, ScoreComponent } from "./components";

export class InputManagerSystem extends TickSystem {
    private initialized = false;
    private canvas?: HTMLCanvasElement;
    private startButtonSelector: string;
    private levelSelectSelector: string;

    constructor(canvas?: HTMLCanvasElement, startButtonSelector = "#g-btn-start", levelSelectSelector = "#level-select") {
        super();
        this.canvas = canvas;
        this.startButtonSelector = startButtonSelector;
        this.levelSelectSelector = levelSelectSelector;
    }

    update(_dt: number): void {
        if (!this.initialized) this.setup();
    }

    private setup() {
        this.initialized = true;
        if (this.canvas) {
            this.canvas.addEventListener("click", (ev) => this.handleCanvasClick(ev as MouseEvent));
        }
        const startButton = document.querySelector(this.startButtonSelector);
        if (startButton) startButton.addEventListener("click", () => this.handleStartClick());
        window.addEventListener("keydown", (e) => this.handleKey(e));
    }

    private handleCanvasClick(ev: MouseEvent) {
        if (!this.world) return;
        const rect = (ev.target as HTMLElement).getBoundingClientRect();
        const canvasX = ev.clientX - rect.left;
        const canvasY = ev.clientY - rect.top;
        const entity = new Entity();
        entity.addComponent(new EventComponent("canvas:click", { rawEvent: ev, x: ev.clientX, y: ev.clientY, canvasX, canvasY, button: ev.button }));
        entity.addComponent(new CanvasEventComponent(canvasX, canvasY));
        this.world.addEntity(entity);
    }

    private handleStartClick() {
        if (!this.world) return;
        const selected = (document.querySelector(this.levelSelectSelector) as HTMLSelectElement | null)?.value;
        const entity = new Entity();
        entity.addComponent(new EventComponent("ui:start", { time: Date.now(), levelId: selected }));
        entity.addComponent(new UIEventComponent("g-btn-start"));
        this.world.addEntity(entity);
    }

    private handleKey(e: KeyboardEvent) {
        if (!this.world) return;
        const entity = new Entity();
        entity.addComponent(new EventComponent("key:press", { key: e.key, code: e.code }));
        this.world.addEntity(entity);
        // convenience: space awards a score event
        if (e.code === "Space") {
            const scoreEntity = new Entity();
            scoreEntity.addComponent(new ScoreComponent(1));
            this.world.addEntity(scoreEntity);
        }
    }
}

export default InputManagerSystem;
