import { Engine } from "./ecs/Engine";
import GridRendererSystem from "./systems/GridRendererSystem";
import InputManagerSystem from "./systems/InputManagerSystem";
import HighscoreSystem from "./systems/HighscoreSystem";
import LevelSystem from "./systems/LevelSystem";
import { Entity } from "./ecs/Entity";
import { EventComponent } from "./systems/components";

const engine = Engine.getInstance();
const world = engine.world;

// Create canvas inside the #game-screen element
const gameScreen = document.querySelector("#game-screen") as HTMLElement | null;
const canvas = document.createElement("canvas");
canvas.style.width = "800px";
canvas.style.height = "600px";
canvas.style.display = "block";
canvas.style.background = "#fafafa";
if (gameScreen) gameScreen.appendChild(canvas);

// Initialize systems
const grid = new GridRendererSystem(canvas, 9, 9, 6, 8);
world.addTickSystem(grid);
world.addEntitySystem(grid as any);

const input = new InputManagerSystem(canvas, "#g-btn-start", "#level-select");
world.addTickSystem(input);

const highs = new HighscoreSystem();
world.addEntitySystem(highs);

// Level system and populate level select
const levelSystem = new LevelSystem<any>();
world.addEntitySystem(levelSystem);
// Prepare level selection screen (buttons) on Start
const titleScreen = document.querySelector("#title-screen") as HTMLElement | null;
const levelScreen = document.querySelector("#level-screen") as HTMLElement | null;
const gameScreenEl = document.querySelector("#game-screen") as HTMLElement | null;

const startBtn = document.querySelector("#g-btn-start") as HTMLButtonElement | null;
if (startBtn) {
	startBtn.addEventListener("click", async () => {
		// show level screen
		if (titleScreen) titleScreen.classList.add("hidden");
		if (levelScreen) levelScreen.classList.remove("hidden");
		// populate buttons
		const list = await levelSystem.loadList();
		if (!levelScreen) return;
		levelScreen.innerHTML = "";
		for (const item of list) {
			const btn = document.createElement("button");
			btn.className = "btn-bold btn-basic large";
			btn.textContent = item.title || item.id;
			btn.dataset.levelId = item.id;
			btn.addEventListener("click", () => {
				// hide level screen, show game
				if (levelScreen) levelScreen.classList.add("hidden");
				if (gameScreenEl) gameScreenEl.classList.remove("hidden");
				// dispatch ui:load-level as an entity so LevelSystem handles it
				const e = new Entity();
				e.addComponent(new EventComponent("ui:load-level", { levelId: item.id }));
				world.addEntity(e);
			});
			levelScreen.appendChild(btn);
		}
	});
}

engine.start(); 

// Load a test level immediately for quick verification
{
	const test = new Entity();
	test.addComponent(new EventComponent("ui:load-level", { levelId: "level1" }));
	world.addEntity(test);
}
