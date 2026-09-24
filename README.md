# LaserCircuit
LaserCircuit is a clever out-of-the-box thinking game, made and optimized for mobile use. This version includes 12 levels, handcrafted by myself, with various different difficulties. For some problems you will need to think out of the box, but you will figure it out. And you only need 6/9 to unlock Stage 2.

The game is live and playable here: [LaserCircuit](https://agentquackyt.github.io/LaserCircuit/)

> This project has been made for Hackclub's Stardance Challenge

> Visit my project there: [Stardance](https://stardance.hackclub.com/projects/45734)  

## How does it work?

> Play the game here: [Web hosted-version](https://agentquackyt.github.io/LaserCircuit/)

Each level has a number of emmiters (which will spawn the beams) and targets, which you need to light up in the right color in order to complete each level. You will need to make use of both mirrors and splitters in order to complete all level. If you are unsure how the game works, there is also a short tutorial in the game that explains the basics before you start solving levels. The live version also includes community levels, so you can try puzzles made by other players. A table of each available colors to mix can be found below this section. Once you complete each level, your highscore is the time it took you to find the solution. When you complete 6 out of 9 level in a stage, you unlock the next one.

Here are the newly mixed colors:

```
red + blue = purple
red + yellow = orange
yellow + green = lime
blue + grenn = aqua

White is created by mixing 2 of the colors above
```

## Development
> Play the game here: [Web hosted-version](https://agentquackyt.github.io/LaserCircuit/)

The app is written in HTML, CSS and Typescript without external frameworks and makes use of Bun's ability to bundle HTML and TS (as drop in replacment for JS) using the very simple `bun build index.html` command. 

I have used this technology for many other web games before and love the freedom this provides without heavy render engines or frameworks. 

The app uses a ECS system written by myself (partially reused from my previous [Hanse](https://agentquackyt.github.io/Hanse2.0/) project), which uses systems for functionality and components for data (this didnt fully work this time, oppsie). 

My UI is inspired by duolingo (especially the button) and is fully written in CSS, making use of modern web features such as color-mix and variables. The level editor is integrated into the app as well, which makes it possible to create levels, test them, and share them with the community from the same project.

## Developing yourself

### Prerequisites

- [Bun](https://bun.sh) (tested v1.4 or higher)

### Installation & Run

1. **Clone the repository:**
   ```bash
   git clone https://github.com/agentquackyt/LaserCircuit.git
   cd LaserCircuit
   ```

2. **Install the development dependencies:**
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

Want to build your own levels and share them with other players?

1. Open the live game and choose **Editor**, or run the development server and open [http://localhost:3000](http://localhost:3000).
2. Sign in with Discord to manage your community levels.
3. Create a new level, set its title and description, choose the grid size, and place emitters, targets, mirrors, splitters, and obstacles on the board.
4. The editor checks that the level is valid and saves changes automatically. You can also save manually, clear the board, or use the JSON upload and download buttons.
5. Publish the level when it is ready. Published levels appear in the community level list, and you can return later to edit or unpublish them.

## AI disclosure
Github Copilot for code completion as well as initial setup (agent, first commit), Google Search AI & Gemini for general, more simple problems.

## License

Distributed under the **MIT License**. Feel free to fork, customize, and build your own circuits!