import { Engine } from "./ecs/Engine";
import GridRendererSystem from "./systems/GridRendererSystem";
import InputManagerSystem from "./systems/InputManagerSystem";
import { HighscoreSystem } from "./systems/HighscoreSystem";
import { SupabaseLevelSystem } from "./systems/LevelSystem";
import { CommunityLevelEditor } from "./editor/CommunityLevelEditor";
import { supabase } from "./database/supabase";
import { DiscordRequiredView } from "./editor/views/DiscordRequiredView";

const engine = Engine.getInstance();
const world = engine.world;

// Create canvas inside the #game-screen element
const gameScreen = document.querySelector(".complete-container") as HTMLElement | null;
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


// Prepare level selection screen (buttons) on Start
const titleScreen = document.querySelector("#title-screen") as HTMLElement | null;
const levelScreen = document.querySelector("#level-screen") as HTMLElement | null;
const editorScreen = document.querySelector("#editor-screen") as HTMLElement | null;
let levelSystem: SupabaseLevelSystem | null = null;
let levelSystemRegistered = false;

document.querySelector("#btn-play")!.addEventListener("click", startGame);
document.querySelector("#btn-play-discover")!.addEventListener("click", startDiscover);
document.querySelector("#btn-play-editor")!.addEventListener("click", startEditor);
document.querySelector("#btn-logout")!.addEventListener("click", logout);
document.querySelector("#btn-home")!.addEventListener("click", showMainMenu);
document.querySelectorAll<HTMLImageElement>(".discord-picture").forEach((image) => {
	image.addEventListener("click", showMainMenu);
});

function showMainMenu() {
	levelScreen?.classList.add("hidden");
	editorScreen?.classList.add("hidden");
	editorScreen!.innerHTML = ""; // Clear editor screen to reset state
	document.querySelector("#game-screen")?.classList.add("hidden");
	document.querySelector<HTMLDialogElement>("#completion-dialog")?.close();
	titleScreen?.classList.remove("hidden");
}

async function startGame() {
	levelSystem ??= new SupabaseLevelSystem();
	if (!levelSystemRegistered) {
		world.addEntitySystem(levelSystem);
		levelSystemRegistered = true;
	}
	engine.start();

	// show level screen
	if (titleScreen) titleScreen.classList.add("hidden");
	if (levelScreen) levelScreen.classList.remove("hidden");

	// Load level list and render 3x3 tabbed grid
	await levelSystem.loadList();
	levelSystem.renderLevelScreen();
}

async function startDiscover() {
	levelSystem ??= new SupabaseLevelSystem();
	if (!levelSystemRegistered) {
		world.addEntitySystem(levelSystem);
		levelSystemRegistered = true;
	}
	engine.start();

	if (titleScreen) titleScreen.classList.add("hidden");
	if (editorScreen) editorScreen.classList.add("hidden");
	if (levelScreen) levelScreen.classList.remove("hidden");

	await levelSystem.loadPublishedCommunityLevels();
	levelSystem.renderDiscoverScreen();
}

async function startEditor() {
	if (titleScreen) titleScreen.classList.add("hidden");
	if (levelScreen) levelScreen.classList.add("hidden");
	if (editorScreen) editorScreen.classList.remove("hidden");
	let isLoggedIn = await loginWithDiscord();
	if (!isLoggedIn) return; // If not logged in, don't proceed
	CommunityLevelEditor.getInstance().load();
} 

supabase.auth.onAuthStateChange((event, session) => {
	if (event === 'SIGNED_IN' && session) {
		console.log('User signed in:', session.user);
		console.log('Discord metadata:', session.user.user_metadata);
		// session.user.user_metadata contains:
		// - full_name / name
		// - avatar_url
		// - custom_claims (e.g. Discord username / discriminator)
		checkAuth(); // Update UI after login
	}

	if (event === 'SIGNED_OUT') {
		console.log('User signed out');
		// Force reload to reset the editor state and UI
		window.location.reload();
	}
});

async function loginWithDiscord() {
	if (await checkAuth()) {
		return true;
	}
	let view = new DiscordRequiredView("editor");
	view.attachTo(editorScreen!);
	return false;
}

// 2. Sign out
async function logout() {
	const { error } = await supabase.auth.signOut();
	if (error) console.error('Error signing out:', error.message);
	checkAuth(); // Update UI after logout
}

async function checkAuth() {
	const { data: { user }, error } = await supabase.auth.getUser();

	if (error || !user) {
		console.log('No valid session or session expired:', error?.message);
		document.querySelectorAll(".discord-picture")!.forEach((img) => img.classList.add("hidden"));
		document.querySelectorAll(".data-logged-in")!.forEach((el) => el.classList.add("hidden"));
		document.querySelector("#home-navigation")?.classList.remove("hidden");
		document.querySelector("#home-navigation-counterpart")?.classList.remove("hidden");
		return false;
	}

	document.querySelectorAll<HTMLImageElement>(".discord-picture")!.forEach((img) => {
		img.src = user.user_metadata.avatar_url || "";
		img.classList.remove("hidden");
	});

	document.querySelectorAll(".data-logged-in")!.forEach((el) => el.classList.remove("hidden"));
	document.querySelector("#home-navigation")?.classList.add("hidden");
	document.querySelector("#home-navigation-counterpart")?.classList.add("hidden");


	console.log('Authenticated user:', user);
	return true;
}

function checkParams() {
	const urlParams = new URLSearchParams(window.location.search);
	const fromParam = urlParams.get('from');
	// strip the query params from the URL to avoid repeated actions on refresh

    const redirectUrl = new URL(window.location.toString());
	console.log('Current URL:', redirectUrl.toString());

	if (fromParam) {
		const newUrl = window.location.origin + window.location.pathname;
		window.history.replaceState({}, document.title, newUrl);
	}

	if (fromParam === 'editor') {
		startEditor();
	}
}

checkAuth();
checkParams();