import GridRendererSystem from "./GridRendererSystem";
import type { LaserLevelData } from "../utils/LaserLogic";
import { ButtonBuilder, ButtonFlavour, ContainerBuilder, TextBuilder, TextType } from "../utils/View";
import { CommonUI } from "../utils/CommonUI";

interface TutorialStep {
    title: string;
    content: string;
    hint: string;
    gameBoard: LaserLevelData;
    // Render using the GridRendererSystem, or a static image if not applicable
}

class Tutorial {
    private _steps: TutorialStep[];
    private _currentStepIndex: number = 0;

    constructor(steps: TutorialStep[]) {
        this._steps = steps;
    }

    get currentStep(): TutorialStep | null {
        return this._steps[this._currentStepIndex] ?? null;
    }

    get stepIndex(): number {
        return this._currentStepIndex;
    }

    get stepCount(): number {
        return this._steps.length;
    }

    nextStep(): void {
        if (this._currentStepIndex < this._steps.length - 1) {
            this._currentStepIndex++;
        }
    }

    previousStep(): void {
        if (this._currentStepIndex > 0) {
            this._currentStepIndex--;
        }
    }

    reset(): void {
        this._currentStepIndex = 0;
    }

    setStepIndex(index: number): void {
        if (index >= 0 && index < this._steps.length) {
            this._currentStepIndex = index;
        }
    }
}

export class TutorialManager {
    private static _instance: TutorialManager | null = null;
    private _tutorial = new Tutorial(TUTORIAL_STEPS);
    private _targetScreen: HTMLElement | null = document.querySelector("#tutorial-screen");
    private _renderer: GridRendererSystem | null = null;
    private _stepView: HTMLElement | null = null;
    private readonly progressStorageKey = "tutorialStep";

    private constructor() {
        document.querySelector("#btn-tutorial")?.addEventListener("click", () => this.runTutorial(true));
    }

    public static getInstance(): TutorialManager {
        if (!TutorialManager._instance) TutorialManager._instance = new TutorialManager();
        return TutorialManager._instance;
    }

    public checkForTutorialCompletion(): boolean {
        return localStorage.getItem("tutorialCompleted") === "true";
    }

    public checkForTutorialDisabled(): boolean {
        return localStorage.getItem("noTutorial") === "true";
    }

    public markTutorialDisabled(): void {
        localStorage.setItem("noTutorial", "true");
    }

    public markTutorialCompleted(): void {
        localStorage.setItem("tutorialCompleted", "true");
    }

    public runTutorial(force = false): void {
        if (!force && (this.checkForTutorialCompletion() || this.checkForTutorialDisabled())) return;
        this._tutorial.reset();
        this.loadTutorialProgress();
        this.showTutorialScreen();
        this.renderCurrentStep();
    }

    private loadTutorialProgress(): void {
        const savedStep = Number.parseInt(localStorage.getItem(this.progressStorageKey) ?? "", 10);
        if (Number.isInteger(savedStep)) {
            this._tutorial.setStepIndex(savedStep);
        }
    }

    private showTutorialScreen(): void {
        document.querySelectorAll(".screen").forEach((screen) => screen.classList.add("hidden"));
        this._targetScreen?.classList.remove("hidden");
        CommonUI.setSubtitle("Tutorial");
    }

    private renderCurrentStep(): void {
        const step = this._tutorial.currentStep;
        const screen = this._targetScreen;
        if (!step || !screen) return;

        this._renderer?.dispose();
        this._renderer = null;
        this._stepView?.remove();

        const view = new ContainerBuilder()
            .setClass("tutorial-step")
            .build();

        const textContainer = new ContainerBuilder()
            .setClass("text-container")
            .build();

        const title = new TextBuilder(TextType.HEADER)
            .setText(step.title)
            .setClass("tutorial-title")
            .build();
        
        const heading = new ContainerBuilder()
            .setClass("tutorial-heading")
            .appendChild(title)
            .build();

        const content = new TextBuilder(TextType.TEXT)
            .setText(step.content)
            .setClass("tutorial-content")
            .build();

        const board = new ContainerBuilder()
            .setClass("tutorial-game-board")
            .build();
        const canvas = document.createElement("canvas");
        canvas.className = "tutorial-board";
        canvas.width = 600;
        canvas.height = 600;
        board.appendChild(canvas);

        const hint = new TextBuilder(TextType.TEXT)
            .setText(step.hint)
            .setClass("tutorial-hint")
            .build();
        const status = new TextBuilder(TextType.TEXT)
            .setClass("tutorial-status")
            .build();

        const controls = new ContainerBuilder()
            .setClass("tutorial-controls")
            .build();
        const back = this.createButton("Exit", ButtonFlavour.BASIC, () => this.leaveTutorial());
        const previous = this.createButton("Previous", ButtonFlavour.BASIC, () => {
            this._tutorial.previousStep();
            this.renderCurrentStep();
        });
        const next = this.createButton(
            this._tutorial.stepIndex === this._tutorial.stepCount - 1 ? "Finish" : "Next",
            ButtonFlavour.SECONDARY,
            () => {
                if (this._tutorial.stepIndex === this._tutorial.stepCount - 1) {
                    this.markTutorialCompleted();
                    this.leaveTutorial(true);
                    return;
                }
                this._tutorial.nextStep();
                this.renderCurrentStep();
            }
        );
        controls.append(back, previous, next);
        textContainer.append(heading, content,hint)
        const contentRow = new ContainerBuilder()
            .setClass("tutorial-content-row")
            .appendChild(textContainer)
            .appendChild(board)
            .build();
        view.append(contentRow, status, controls);
        screen.appendChild(view);
        this._stepView = view;

        this._renderer = new GridRendererSystem(canvas, 5, 5, 6, 8);
        this._renderer.setLevelData(step.gameBoard);
        this._renderer.setSimulationEnabled(true);

        const updateState = () => {
            const solved = this._renderer?.getSimulation()?.solved === true;
            status.textContent = solved ? "Lesson complete. You can continue." : "Route the laser to continue.";
            next.disabled = !solved;
            previous.disabled = this._tutorial.stepIndex === 0;
        };

        canvas.addEventListener("mousedown", (event) => {
            event.preventDefault();
            const rect = canvas.getBoundingClientRect();
            this._renderer?.handleCanvasClick(event.clientX - rect.left, event.clientY - rect.top, event.button);
            this._renderer?.refresh();
            updateState();
        });
        requestAnimationFrame(() => this._renderer?.refresh());
        updateState();
    }

    private createButton(label: string, flavour: ButtonFlavour, onClick: () => void): HTMLButtonElement {
        return new ButtonBuilder()
            .setText(label)
            .setBold(flavour)
            .setOnClick(onClick)
            .build();
    }

    private leaveTutorial(completed = false): void {
        if (completed) {
            localStorage.removeItem(this.progressStorageKey);
        } else {
            localStorage.setItem(this.progressStorageKey, String(this._tutorial.stepIndex));
        }
        this.markTutorialDisabled();
        this._renderer?.dispose();
        this._renderer = null;
        this._stepView?.remove();
        this._stepView = null;
        this._targetScreen?.classList.add("hidden");
        CommonUI.setSubtitle("by Jonas Gaden");
        document.querySelector("#title-screen")?.classList.remove("hidden");
    }
}

const TUTORIAL_STEPS: TutorialStep[] = [
    {
        title: "Meet the 5x5 field",
        content: "Every puzzle is a field of cells. The laser starts at an emitter and travels one cell at a time toward a target.",
        hint: "This board is already complete. Notice the emitter, beam, and matching target.",
        gameBoard: {
            grid: { width: 5, height: 5 },
            emitters: [{ x: 1, y: 2, dir: "right", color: "red" }],
            targets: [{ x: 3, y: 2, color: "red" }]
        }
    },
    {
        title: "Match the light",
        content: "A target counts when the beam reaches it with the right color. Route the red beam across the row into the red target.",
        hint: "The target lights up when the beam reaches it.",
        gameBoard: {
            grid: { width: 5, height: 5 },
            emitters: [{ x: 0, y: 2, dir: "right", color: "red" }],
            targets: [{ x: 4, y: 2, color: "red" }]
        }
    },
    {
        title: "Turn a mirror",
        content: "Mirrors redirect the beam. Click the mirror to rotate it between its two orientations until the laser reaches the target.",
        hint: "Click the mirror once. The correct orientation sends the beam downward.",
        gameBoard: {
            grid: { width: 5, height: 5 },
            emitters: [{ x: 1, y: 2, dir: "right", color: "red" }],
            pieces: [{ type: "mirror", x: 3, y: 2, orientation: "/", rotatable: true }],
            targets: [{ x: 3, y: 3, color: "red" }]
        }
    },
    {
        title: "Route the circuit",
        content: "Now combine two turns. Plan the whole path before rotating the mirrors, then light the final target.",
        hint: "Rotate both mirrors: first turn the beam down, then turn it left into the target.",
        gameBoard: {
            grid: { width: 5, height: 5 },
            emitters: [{ x: 0, y: 2, dir: "right", color: "red" }],
            pieces: [
                { type: "mirror", x: 1, y: 2, orientation: "/", rotatable: true },
                { type: "mirror", x: 1, y: 4, orientation: "\\", rotatable: true }
            ],
            targets: [{ x: 0, y: 4, color: "red" }]
        }
    },
    {
        title: "Splitting the beam",
        content: "Splitters divide the beam into two paths. Use a splitter to light two targets at once.",
        hint: "Observe how the splitter works. The beam enters from the left and exits up, left and down.",
        gameBoard: {
            grid: { width: 5, height: 5 },
            emitters: [{ x: 0, y: 2, dir: "right", color: "red" }],
            pieces: [{ type: "splitter", x: 4, y: 2, orientation: "horizontal", rotatable: false }],
            targets: [
                { x: 4, y: 1, color: "red" },
                { x: 4, y: 3, color: "red" }
            ]
        }
    },
    {
        title: "Mixing colors",
        content: "Two beams of different colors can mix to create a new color. Use a splitter to send the red and blue beams into the purple target.",
        hint: "The red and blue beams combine into purple when they meet in a splitter.",
        gameBoard: {
            grid: { width: 5, height: 5 },
            emitters: [
                { x: 0, y: 1, dir: "right", color: "red" },
                { x: 0, y: 3, dir: "right", color: "blue" }
            ],
            pieces: [
                { type: "splitter", x: 2, y: 2, orientation: "horizontal", rotatable: false },
                { type: "mirror", x: 2, y: 3, orientation: "/", rotatable: false },
                { type: "mirror", x: 2, y: 1, orientation: "\\", rotatable: false }
            
            ],
            targets: [{ x: 4, y: 2, color: "purple" }]
        }
    },
    {
        title: "Place your own pieces",
        content: "You can place pieces on the board to redirect the beam. Try placing and cycling through different piece types by pressing left mouse button.",
        hint: "Use the mirror to turn the red beam down, then use the splitter to send it into both targets.",
        gameBoard: {
            grid: { width: 5, height: 5 },
            emitters: [{ x: 0, y: 0, dir: "right", color: "red" }],
            targets: [
                { x: 4, y: 1, color: "red" },
                { x: 4, y: 3, color: "red" }
            ],
            rules: {
                canPlaceOwnBlocks: true
            }
        }
    }
];

