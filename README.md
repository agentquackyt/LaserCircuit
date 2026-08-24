# LaserCircuit

An addictive grid-based puzzle game where you route, reflect, and manipulate laser beams across intricate circuits to power targets and clear levels. Built from scratch with **TypeScript**, an **Entity-Component-System (ECS)** architecture, and bundled with **Bun**.

## Highlights

- **12 Handcrafted Levels:** Ranging from introductory logic puzzles to mind-bending laser mazes.
- **Custom ECS Engine:** Lightweight, modular Entity-Component-System written in pure TypeScript for crisp simulation and rendering.
- **Built-in Level Editor:** Visual level creator (`editor.html`) allowing you to design, test, and export your own puzzle maps into JSON.
- **Zero Heavy Frameworks:** Pure web performance with instant load times powered by Bun.

## How to Play

Play the game here: [Web hosted-version](https://agentquackyt.github.io/LaserCircuit/)

1. **Inspect the Circuit:** Identify the laser emitters, mirrors, splitters, blockers, and target receptors.
2. **Rotate & Position Elements:** Click grid pieces to adjust laser angles and directions.
3. **Power All Targets:** Guide every laser path to activate all designated targets simultaneously to unlock the next level.
4. **Beat Your Highscore:** Solve puzzles in fewer time to climb the ranks.

## Project Structure

```text
LaserCircuit/
├── ts/
│   ├── ecs/              # Custom lightweight ECS (Engine, Entity, System)
│   ├── systems/          # GridRenderer, InputManager, LevelSystem, HighscoreSystem
│   ├── utils/            # LaserLogic, FancyText
│   └── game.ts           # Game initialization & game loop
├── level/                # Handcrafted level definitions (JSON)
├── css/                  # Styling & themes
├── editor.html           # In-browser level editor
├── index.html            # Main game entry
├── build.ts              # Bun build pipeline
└── server.ts             # Development server
```
--

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (tested v1.4 or higher)

### Installation & Run

1. **Clone the repository:**
   ```bash
   git clone https://github.com/agentquackyt/LaserCircuit.git
   cd LaserCircuit
   ```

2. **Install dependencies:**
   ```bash
   bun install
   ```

3. **Start the local dev server:**
   ```bash
   bun run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.
   
   Or open [the Editor](http://localhost:3000/editor) to edit and create levels (Make sure to select the folder)

4. **Build for production:**
   ```bash
   bun run build.ts
   ```
   The bundled static files will be exported to the `docs/` directory (ready for GitHub Pages or static web hosting).

## Level Creation

Want to build your own levels?
1. Open `editor.html` in your browser (or navigate to `/editor` via the dev server for full support).
2. Place laser sources, mirrors, and splitters onto the grid.
3. Export the output JSON into `level/levelX.json` and register it inside `level/list.json` (bun run list.ts).


## License

Distributed under the **MIT License**. Feel free to fork, customize, and build your own circuits!
