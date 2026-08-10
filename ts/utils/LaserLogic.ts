export type LightColor = "red" | "blue" | "purple";
export type Direction = "up" | "right" | "down" | "left";

export type Emitter = { x: number; y: number; dir: Direction; color: LightColor };
export type Target = { x: number; y: number; color: LightColor };

export type MirrorPiece = {
	type: "mirror";
	x: number;
	y: number;
	orientation: "/" | "\\";
	rotatable?: boolean;
};

export type SplitterPiece = {
	type: "splitter";
	x: number;
	y: number;
	orientation: "horizontal" | "vertical";
	rotatable?: boolean;
};

export type AdderPiece = {
	type: "adder";
	x: number;
	y: number;
	dir: Direction;
	rotatable?: boolean;
};

export type LaserPiece = MirrorPiece | SplitterPiece | AdderPiece;

export type LaserLevelData = {
	grid?: { width?: number; height?: number };
	emitters?: Emitter[];
	targets?: Target[];
	pieces?: LaserPiece[];
};

export type BeamSegment = {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	color: LightColor;
};

export type LaserSimulationResult = {
	segments: BeamSegment[];
	targetColors: Map<string, LightColor | undefined>;
	targetHits: boolean[];
	solved: boolean;
};

const DIRECTION_ORDER: Direction[] = ["up", "right", "down", "left"];

const DELTA_BY_DIRECTION: Record<Direction, { x: number; y: number }> = {
	up: { x: 0, y: -1 },
	right: { x: 1, y: 0 },
	down: { x: 0, y: 1 },
	left: { x: -1, y: 0 },
};

const CELL_VISIT_LIMIT = 2;

function toCellKey(x: number, y: number): string {
	return `${x},${y}`;
}

function rotateDirection(dir: Direction): Direction {
	return DIRECTION_ORDER[(DIRECTION_ORDER.indexOf(dir) + 1) % DIRECTION_ORDER.length] as Direction;
}

function inBounds(x: number, y: number, width: number, height: number): boolean {
	return x >= 0 && y >= 0 && x < width && y < height;
}

function mixPair(a: LightColor, b: LightColor): LightColor {
	if (a === b) return a;
	if (a === "purple" || b === "purple") return "purple";
	return "purple";
}

export function mixLightColors(colors: LightColor[]): LightColor | undefined {
	if (colors.length === 0) return undefined;
	let mixed: LightColor = colors[0] as LightColor;
	for (let i = 1; i < colors.length; i++) mixed = mixPair(mixed, colors[i] as LightColor);
	return mixed;
}

export function rotatePiece(piece: LaserPiece): LaserPiece {
	if (piece.type === "mirror") {
		return { ...piece, orientation: piece.orientation === "/" ? "\\" : "/" };
	}
	if (piece.type === "splitter") {
		return { ...piece, orientation: piece.orientation === "horizontal" ? "vertical" : "horizontal" };
	}
	return { ...piece, dir: rotateDirection(piece.dir) };
}

function reflect(direction: Direction, mirror: "/" | "\\"): Direction {
	if (mirror === "/") {
		if (direction === "up") return "right";
		if (direction === "right") return "up";
		if (direction === "down") return "left";
		return "down";
	}
	if (direction === "up") return "left";
	if (direction === "left") return "up";
	if (direction === "down") return "right";
	return "down";
}

export function simulateLaserLevel(
	width: number,
	height: number,
	emitters: Emitter[],
	pieces: LaserPiece[],
	targets: Target[]
): LaserSimulationResult {
	const segments: BeamSegment[] = [];
	const targetColors = new Map<string, LightColor | undefined>();
	const cellHits = new Map<string, LightColor[]>();
	const pieceByCell = new Map<string, LaserPiece>();
	for (const piece of pieces) pieceByCell.set(toCellKey(piece.x, piece.y), piece);

	const adderInputs = new Map<string, LightColor[]>();
	const stateCounts = new Map<string, number>();

	type BeamState = { x: number; y: number; dir: Direction; color: LightColor };

	const pushCellHit = (x: number, y: number, color: LightColor) => {
		const key = toCellKey(x, y);
		const current = cellHits.get(key) ?? [];
		current.push(color);
		cellHits.set(key, current);
	};

	const trace = (initial: BeamState[], enableAdderCapture: boolean) => {
		const queue: BeamState[] = [...initial];
		while (queue.length > 0) {
			const beam = queue.shift()!;
			const delta = DELTA_BY_DIRECTION[beam.dir];
			const nx = beam.x + delta.x;
			const ny = beam.y + delta.y;
			if (!inBounds(nx, ny, width, height)) continue;

			segments.push({ x1: beam.x, y1: beam.y, x2: nx, y2: ny, color: beam.color });
			pushCellHit(nx, ny, beam.color);

			const stateKey = `${nx},${ny},${beam.dir},${beam.color}`;
			const seen = stateCounts.get(stateKey) ?? 0;
			if (seen >= CELL_VISIT_LIMIT) continue;
			stateCounts.set(stateKey, seen + 1);

			const piece = pieceByCell.get(toCellKey(nx, ny));
			if (!piece) {
				queue.push({ x: nx, y: ny, dir: beam.dir, color: beam.color });
				continue;
			}

			if (piece.type === "mirror") {
				queue.push({ x: nx, y: ny, dir: reflect(beam.dir, piece.orientation), color: beam.color });
				continue;
			}

			if (piece.type === "splitter") {
				const directions: Direction[] = piece.orientation === "horizontal" ? ["left", "right"] : ["up", "down"];
				for (const direction of directions) queue.push({ x: nx, y: ny, dir: direction, color: beam.color });
				continue;
			}

			if (piece.type === "adder") {
				if (enableAdderCapture) {
					const key = toCellKey(piece.x, piece.y);
					const current = adderInputs.get(key) ?? [];
					current.push(beam.color);
					adderInputs.set(key, current);
				}
				continue;
			}
		}
	};

	trace(emitters.map((emitter) => ({ ...emitter })), true);

	const adderOutputs: BeamState[] = [];
	for (const piece of pieces) {
		if (piece.type !== "adder") continue;
		const input = adderInputs.get(toCellKey(piece.x, piece.y));
		if (!input || input.length === 0) continue;
		const mixed = mixLightColors(input);
		if (!mixed) continue;
		adderOutputs.push({ x: piece.x, y: piece.y, dir: piece.dir, color: mixed });
	}

	trace(adderOutputs, false);

	const targetHits = targets.map((target) => {
		const mixed = mixLightColors(cellHits.get(toCellKey(target.x, target.y)) ?? []);
		targetColors.set(toCellKey(target.x, target.y), mixed);
		return mixed === target.color;
	});

	return {
		segments,
		targetColors,
		targetHits,
		solved: targets.length > 0 && targetHits.every(Boolean),
	};
}
