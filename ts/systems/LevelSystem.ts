import { EntitySystem } from "../ecs/System";
import { Entity } from "../ecs/Entity";
import { EventComponent } from "./components";
import { HighscoreSystem } from "./HighscoreSystem";
import { supabase } from "../database/supabase";
import { Cache } from "../utils/cache";

export interface LevelRecord {
    id: string;
    slug: string;
    title: string;
    period: 'weekly' | 'monthly' | 'standard';
    level_data: any; // Matches your laser circuit grid format
}

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


            const labelID = document.createElement("span");
            labelID.className = "level-id";
            labelID.textContent = `${this.currentTabIndex + 1}.${(globalIndex % 9) + 1}`;

            const labelTitle = document.createElement("span");
            labelTitle.className = "level-number";
            labelTitle.textContent = item.title || `Level ${globalIndex + 1}`;

            const labelScore = document.createElement("span");
            labelScore.className = "level-score";
            labelScore.textContent = score ? HighscoreSystem.formatScore(score.time, score.moves) : "--:--";

            btn.appendChild(labelID);
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

export class SupabaseLevelSystem extends LevelSystem {
    public weeklyLevel: LevelRecord | null = null;

    override async loadList(): Promise<Array<{ id: string; title?: string; [k: string]: any }>> {
        const CACHE_KEY = "standard_levels_list";

        // Check 15-minute cache
        const cached = Cache.get<Array<any>>(CACHE_KEY);
        if (cached) {
            this.list = cached;
            return this.list;
        }

        const { data, error } = await supabase
            .from("levels")
            .select("id, slug, title, period, level_data")
            .eq("period", "standard")
            .order("created_at", { ascending: true });

        if (error || !data) {
            console.error("Failed to load levels from Supabase:", error);
            this.list = [];
            return [];
        }

        this.list = data.map((row) => ({
            id: row.id,
            slug: row.slug,
            title: row.title,
            period: row.period,
            level_data: row.level_data,
        }));

        // Store result for 15 minutes
        Cache.set(CACHE_KEY, this.list);
        return this.list;
    }

    async getCurrentWeeklyLevel(): Promise<LevelRecord | null> {
        const CACHE_KEY = "current_weekly_level";

        // Check 15-minute cache
        const cached = Cache.get<LevelRecord>(CACHE_KEY);
        if (cached) {
            this.weeklyLevel = cached;
            return this.weeklyLevel;
        }

        const { data, error } = await supabase
            .from("levels")
            .select("*")
            .eq("period", "weekly")
            .order("active_from", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error || !data) {
            console.warn("No active weekly level found:", error);
            this.weeklyLevel = null;
            return null;
        }

        this.weeklyLevel = data as LevelRecord;

        // Store result for 15 minutes
        Cache.set(CACHE_KEY, this.weeklyLevel);
        return this.weeklyLevel;
    }

    override async loadLevel(id: string): Promise<any> {
        try {
            let record = this.list.find((item) => item.id === id || item.slug === id);

            if (!record && this.weeklyLevel && (this.weeklyLevel.id === id || this.weeklyLevel.slug === id)) {
                record = this.weeklyLevel;
            }

            // Check level-specific cache if not preloaded in memory
            if (!record || !record.level_data) {
                const CACHE_KEY = `level_${id}`;
                const cachedLevel = Cache.get<any>(CACHE_KEY);

                if (cachedLevel) {
                    record = cachedLevel;
                } else {
                    const { data, error } = await supabase
                        .from("levels")
                        .select("*")
                        .or(`id.eq.${id},slug.eq.${id}`)
                        .limit(1)
                        .single();

                    if (error || !data) throw new Error(`Level ${id} not found in Supabase`);
                    record = data;
                    Cache.set(CACHE_KEY, record);
                }
            }

            if(record === undefined) return;

            this.currentLevelId = record.id;
            this.currentLevel = record.level_data;

            // DOM & Screen updates
            const titleEl = document.getElementById("lvl-title");
            if (titleEl) titleEl.textContent = record.title || `Level ${id}`;

            const idEl = document.getElementById("lvl-id");
            if (idEl) {
                const index = this.list.findIndex((l) => l.id === record.id);
                if (index !== -1) {
                    const tab = Math.floor(index / 9) + 1;
                    const slot = (index % 9) + 1;
                    idEl.textContent = `${tab}.${slot}`;
                } else {
                    idEl.textContent = record.slug || "SP";
                }
            }

            try { localStorage.setItem("laser.last_level", id); } catch (_e) { }

            // @ts-ignore
            this.startTime = performance.now();
            // @ts-ignore
            this.movesCount = 0;
            // @ts-ignore
            this.isPlaying = true;

            if (this.world) {
                const e = new Entity();
                e.addComponent(new EventComponent("level:loaded", { id, data: this.currentLevel }));
                this.world.addEntity(e);
            }

            return this.currentLevel;
        } catch (e) {
            console.warn("SupabaseLevelSystem: loadLevel failed", e);
            return undefined;
        }
    }
}