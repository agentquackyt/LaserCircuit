import { EntitySystem } from "../ecs/System";
import { Entity } from "../ecs/Entity";
import { EventComponent } from "./components";
import { HighscoreSystem } from "./HighscoreSystem";

export class LevelSystem<T = unknown> extends EntitySystem {
    public list: Array<{ id: string; title?: string;[k: string]: any }> = [];
    public currentLevelId?: string;
    public currentLevel?: T;

    private storageKey = "laser.last_level";
    private currentTabIndex: number = 0;
    private readonly LEVELS_PER_TAB = 9;
    private readonly UNLOCK_REQ = 6;

    // Track active gameplay stats
    private startTime: number = 0;
    private movesCount: number = 0;
    private isPlaying: boolean = false;

    constructor() {
        super();
        this.setupDialogActions();
        this.setupInputTracking();
    }

    private setupInputTracking(): void {
        // Track moves on grid click/interaction
        const canvas = document.querySelector("#game-screen canvas");
        if (canvas) {
            canvas.addEventListener("pointerdown", () => {
                if (this.isPlaying) {
                    this.movesCount++;
                }
            });
        }
    }

    async loadList(): Promise<Array<{ id: string; title?: string }>> {
        try {
            const res = await fetch("./level/list.json");
            if (!res.ok) throw new Error("Failed to load level list");
            const json = await res.json();
            this.list = Array.isArray(json) ? json : [];
            return this.list;
        } catch (e) {
            console.warn("LevelSystem: could not load list.json", e);
            this.list = [];
            return this.list;
        }
    }

    async loadLevel(id: string): Promise<T | undefined> {
        try {
            const res = await fetch(`./level/${id}.json`);
            if (!res.ok) throw new Error(`Failed to load level ${id}`);
            const json = await res.json();
            this.currentLevelId = id;
            this.currentLevel = json as T;

            // display the level title in the game screen
            const titleEl = document.getElementById("lvl-title");
            if (titleEl) {
                // @ts-expect-error
                let lvlTitle = this.currentLevel.title || `Level ${id}`;
                titleEl.textContent = lvlTitle;
            }

            const idEl = document.getElementById("lvl-id");
            if (idEl) {
                // strip leading level prefix ("level1") then divide by 9 to get the tab index
                let lvlNumber = new Number(id.replace("level", ""));
                console.log("LevelSystem: loadLevel", id, lvlNumber);
                let lvlID = `${Math.floor((lvlNumber.valueOf() - 1) / this.LEVELS_PER_TAB) + 1}.${(lvlNumber.valueOf() - 1) % this.LEVELS_PER_TAB + 1}`;
                idEl.textContent = lvlID;
            }

            try { localStorage.setItem(this.storageKey, id); } catch (_e) { }

            // Start timer and reset moves
            this.startTime = performance.now();
            this.movesCount = 0;
            this.isPlaying = true;

            // Emit a world entity announcing the level was loaded
            if (this.world) {
                const e = new Entity();
                e.addComponent(new EventComponent("level:loaded", { id, data: this.currentLevel }));
                this.world.addEntity(e);
            }
            return this.currentLevel;
        } catch (e) {
            console.warn("LevelSystem: loadLevel failed", e);
            return undefined;
        }
    }

    onEntityAdded(entity: Entity): void {
        const ev = entity.getComponent(EventComponent);
        if (!ev) return;

        if (ev.type === "ui:load-level") {
            const levelId = ev.payload?.levelId;
            if (levelId) this.loadLevel(levelId);
        } else if (ev.type === "level:completed" || ev.type === "level:solved") {
            this.handleLevelCompletion();
        }
    }

    onEntityRemoved(_entity: Entity): void {
        // no-op
    }

    public handleLevelCompletion(): void {
        if (!this.isPlaying || !this.currentLevelId) return;
        this.isPlaying = false;

        const timeMs = Math.max(100, performance.now() - this.startTime);
        const isNewRecord = HighscoreSystem.saveScore(this.currentLevelId, timeMs, this.movesCount);
        const bestScore = HighscoreSystem.getScore(this.currentLevelId);

        // Notify systems (e.g. HighscoreSystem) via event
        if (this.world) {
            const e = new Entity();
            e.addComponent(new EventComponent("level:completed", {
                levelId: this.currentLevelId,
                time: timeMs,
                moves: this.movesCount
            }));
            this.world.addEntity(e);
        }

        this.showCompletionDialog(timeMs, this.movesCount, bestScore, isNewRecord);
    }

    public isTabUnlocked(tabIndex: number): boolean {
        if (tabIndex === 0) return true;
        for (let i = 0; i < tabIndex; i++) {
            const start = i * this.LEVELS_PER_TAB;
            const tabLevels = this.list.slice(start, start + this.LEVELS_PER_TAB);
            const completedCount = tabLevels.filter((lvl) => HighscoreSystem.isCompleted(lvl.id)).length;
            if (completedCount < this.UNLOCK_REQ) {
                return false;
            }
        }
        return true;
    }

    public renderLevelScreen(): void {
        const levelScreen = document.querySelector("#level-screen") as HTMLElement | null;
        const gameScreenEl = document.querySelector("#game-screen") as HTMLElement | null;
        const titleScreen = document.querySelector("#title-screen") as HTMLElement | null;
        if (!levelScreen) return;

        levelScreen.innerHTML = "";

        const totalTabs = Math.ceil(this.list.length / this.LEVELS_PER_TAB) || 1;
        const container = document.createElement("div");
        container.className = "level-select-container";

        const tabBar = document.createElement("div");
        tabBar.className = "level-tab-bar";

        for (let t = 0; t < totalTabs; t++) {
            const tabBtn = document.createElement("button");
            const unlocked = this.isTabUnlocked(t);
            const isActive = t === this.currentTabIndex;

            tabBtn.className = `btn-bold ${isActive ? "btn-primary" : "btn-basic"} small`;
            tabBtn.textContent = `Stage ${t + 1}`;

            if (!unlocked) {
                tabBtn.disabled = true;
                tabBtn.style.opacity = "0.4";
                tabBtn.title = `Complete at least ${this.UNLOCK_REQ}/9 levels in Stage ${t} to unlock`;
            } else {
                tabBtn.onclick = () => {
                    this.currentTabIndex = t;
                    this.renderLevelScreen();
                };
            }
            tabBar.appendChild(tabBtn);
        }

        const grid = document.createElement("div");
        grid.className = "level-grid-3x3";

        const startIdx = this.currentTabIndex * this.LEVELS_PER_TAB;
        const currentTabLevels = this.list.slice(startIdx, startIdx + this.LEVELS_PER_TAB);

        currentTabLevels.forEach((item, indexWithinTab) => {
            const globalIndex = startIdx + indexWithinTab;
            const score = HighscoreSystem.getScore(item.id);
            const completed = !!score;

            const btn = document.createElement("button");
            btn.className = `btn-bold level-cell-btn ${completed ? "btn-secondary" : "btn-basic"}`;
            btn.dataset.levelId = item.id;

            const labelTitle = document.createElement("span");
            labelTitle.className = "level-number";
            labelTitle.textContent = item.title || `Level ${globalIndex + 1}`;

            const labelScore = document.createElement("span");
            labelScore.className = "level-score";
            labelScore.textContent = score ? HighscoreSystem.formatScore(score.time, score.moves) : "--:--";

            btn.appendChild(labelTitle);
            btn.appendChild(labelScore);

            btn.addEventListener("click", () => {
                if (levelScreen) levelScreen.classList.add("hidden");
                if (gameScreenEl) gameScreenEl.classList.remove("hidden");

                if (this.world) {
                    const e = new Entity();
                    e.addComponent(new EventComponent("ui:load-level", { levelId: item.id }));
                    this.world.addEntity(e);
                }
            });

            grid.appendChild(btn);
        });

        const footer = document.createElement("div");
        footer.className = "level-footer";
        const backBtn = document.createElement("button");
        backBtn.className = "btn-bold btn-basic medium";
        backBtn.textContent = "Back to Menu";
        backBtn.onclick = () => {
            if (levelScreen) levelScreen.classList.add("hidden");
            if (titleScreen) titleScreen.classList.remove("hidden");
        };
        footer.appendChild(backBtn);

        container.appendChild(tabBar);
        container.appendChild(grid);
        container.appendChild(footer);
        levelScreen.appendChild(container);
    }

    private setupDialogActions(): void {
        const dialog = document.getElementById("completion-dialog") as HTMLDialogElement | null;
        const levelScreen = document.querySelector("#level-screen") as HTMLElement | null;
        const gameScreenEl = document.querySelector("#game-screen") as HTMLElement | null;

        // Manual complete button trigger if present in HTML
        document.getElementById("complete-level-btn")?.addEventListener("click", () => {
            this.handleLevelCompletion();
        });

        document.getElementById("completion-btn-menu")?.addEventListener("click", () => {
            if (dialog && typeof dialog.close === "function") dialog.close();
            if (gameScreenEl) gameScreenEl.classList.add("hidden");
            if (levelScreen) levelScreen.classList.remove("hidden");
            this.renderLevelScreen();
        });

        document.getElementById("completion-btn-retry")?.addEventListener("click", () => {
            if (dialog && typeof dialog.close === "function") dialog.close();
            if (this.currentLevelId && this.world) {
                const e = new Entity();
                e.addComponent(new EventComponent("ui:load-level", { levelId: this.currentLevelId }));
                this.world.addEntity(e);
            }
        });

        document.getElementById("completion-btn-finish")?.addEventListener("click", () => {
            if (dialog && typeof dialog.close === "function") dialog.close();
            const currentIndex = this.list.findIndex((l) => l.id === this.currentLevelId);
            const nextIdx = currentIndex + 1;

            if (nextIdx >= 0 && nextIdx < this.list.length) {
                const nextTab = Math.floor(nextIdx / this.LEVELS_PER_TAB);
                if (this.isTabUnlocked(nextTab)) {
                    if (this.world) {
                        const e = new Entity();
                        e.addComponent(new EventComponent("ui:load-level", { levelId: this.list[nextIdx]!.id }));
                        this.world.addEntity(e);
                    }
                    return;
                }
            }

            if (gameScreenEl) gameScreenEl.classList.add("hidden");
            if (levelScreen) levelScreen.classList.remove("hidden");
            this.renderLevelScreen();
        });
    }

    private showCompletionDialog(timeMs: number, moves: number, bestScore: any, isNewRecord: boolean): void {
        const dialog = document.getElementById("completion-dialog") as HTMLDialogElement | null;
        const currentTimeEl = document.getElementById("completion-current-time");
        const bestTimeEl = document.getElementById("completion-best-time");
        const newRecordBanner = document.getElementById("completion-new-record");

        if (currentTimeEl) {
            currentTimeEl.textContent = HighscoreSystem.formatScore(timeMs, moves);
        }
        if (bestTimeEl && bestScore) {
            bestTimeEl.textContent = HighscoreSystem.formatScore(bestScore.time, bestScore.moves);
        }
        if (newRecordBanner) {
            newRecordBanner.classList.toggle("hidden", !isNewRecord);
        }

        if (dialog && typeof dialog.showModal === "function") {
            dialog.showModal();
        }
    }
}

export default LevelSystem;