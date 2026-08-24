import { Engine } from "./ecs/Engine";
import GridRendererSystem from "./systems/GridRendererSystem";
import InputManagerSystem from "./systems/InputManagerSystem";
import {HighscoreSystem} from "./systems/HighscoreSystem";
import {LevelSystem} from "./systems/LevelSystem";
import { Entity } from "./ecs/Entity";
import { EventComponent } from "./systems/components";

const engine = Engine.getInstance();
const world = engine.world;

// Create canvas inside the #game-screen element
const gameScreen = document.querySelector("#complete-level-btn") as HTMLElement | null;
const canvas = document.createElement("canvas");
canvas.className = "game-board";
canvas.style.display = "block";
if (gameScreen) gameScreen.before(canvas);

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

const startBtn = (document.querySelector("#btn-play") || document.querySelector("#g-btn-start")) as HTMLButtonElement | null;
if (startBtn) {
	startBtn.addEventListener("click", async () => {
		// show level screen
		if (titleScreen) titleScreen.classList.add("hidden");
		if (levelScreen) levelScreen.classList.remove("hidden");
		
		// Load level list and render 3x3 tabbed grid
		await levelSystem.loadList();
		levelSystem.renderLevelScreen();
	});
}

engine.start();