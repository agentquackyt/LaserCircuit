export type LightColor =
    | "red"
    | "orange"
    | "yellow"
    | "lime"
    | "green"
    | "cyan"
    | "blue"
    | "purple"
    | "white";

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

export type MixerPiece = {
    type: "mixer";
    x: number;
    y: number;
    dir: Direction;
    rotatable?: boolean;
};

export type ObstaclePiece = {
    type: "obstacle";
    x: number;
    y: number;
};

export type LaserPiece = MirrorPiece | SplitterPiece | AdderPiece | MixerPiece | ObstaclePiece;

export type LevelRules = {
    canPlaceOwnBlocks?: boolean;
    blockCycle?: Array<LaserPiece | null>;
};

export type LaserLevelData = {
    id?: string;
    title?: string;
    grid?: { width?: number; height?: number };
    emitters?: Emitter[];
    targets?: Target[];
    pieces?: LaserPiece[];
    rules?: LevelRules;
    metadata?: Record<string, unknown>;
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

// 4-bit Channel Bitmask: [Yellow (8), Blue (4), Green (2), Red (1)]
const COLOR_MASKS: Record<LightColor, number> = {
    red: 1,      // 0001
    green: 2,    // 0010
    blue: 4,     // 0100
    yellow: 8,   // 1000
    orange: 9,   // 1001 (Red + Yellow)
    lime: 10,    // 1010 (Green + Yellow)
    purple: 5,   // 0101 (Red + Blue)
    cyan: 6,     // 0110 (Green + Blue)
    white: 7,    // 0111 (Red + Green + Blue) / 1111
};

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

function oppositeDirection(dir: Direction): Direction {
    if (dir === "up") return "down";
    if (dir === "right") return "left";
    if (dir === "down") return "up";
    return "right";
}

function directionBit(dir: Direction): number {
    if (dir === "up") return 1;
    if (dir === "right") return 2;
    if (dir === "down") return 4;
    return 8;
}

function inBounds(x: number, y: number, width: number, height: number): boolean {
    return x >= 0 && y >= 0 && x < width && y < height;
}

function colorToMask(color: LightColor): number {
    return COLOR_MASKS[color] ?? 0;
}

function maskToColor(mask: number): LightColor | undefined {
    switch (mask) {
        case 1: return "red";
        case 2: return "green";
        case 3: return "yellow";    // Additive Red + Green produces Yellow
        case 4: return "blue";
        case 5: return "purple";    // Red + Blue
        case 6: return "cyan";      // Green + Blue
        case 7: return "white";     // Red + Green + Blue
        case 8: return "yellow";
        case 9: return "orange";    // Red + Yellow
        case 10: return "lime";     // Green + Yellow
        case 11: return "orange";   // Red + Green + Yellow
        case 12: return "cyan";     // Blue + Yellow
        case 13: return "purple";   // Red + Blue + Yellow
        case 14: return "cyan";     // Green + Blue + Yellow
        case 15: return "white";    // All channels
        default: return undefined;
    }
}

export function mixLightColors(colors: LightColor[]): LightColor | undefined {
    if (colors.length === 0) return undefined;
    let mask = 0;
    for (const color of colors) mask |= colorToMask(color);
    return maskToColor(mask);
}

export function rotatePiece(piece: LaserPiece): LaserPiece {
    if (piece.type === "mirror") {
        return { ...piece, orientation: piece.orientation === "/" ? "\\" : "/" };
    }
    if (piece.type === "splitter") {
        return { ...piece, orientation: piece.orientation === "horizontal" ? "vertical" : "horizontal" };
    }
    if (piece.type === "mixer") {
        return { type: "splitter", x: piece.x, y: piece.y, orientation: "horizontal", rotatable: piece.rotatable };
    }
    if (piece.type === "obstacle") {
        return piece;
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

    const targetByCell = new Map<string, Target>();
    for (const target of targets) targetByCell.set(toCellKey(target.x, target.y), target);

    const emitterByCell = new Map<string, Emitter>();
    for (const emitter of emitters) emitterByCell.set(toCellKey(emitter.x, emitter.y), emitter);

    const pieceByCell = new Map<string, LaserPiece>();
    for (const piece of pieces) pieceByCell.set(toCellKey(piece.x, piece.y), piece);

    type BeamState = { x: number; y: number; dir: Direction; color: LightColor };
    type DirectionalInputs = { colors: LightColor[]; inputMask: number };

    const pushCellHit = (x: number, y: number, color: LightColor) => {
        const key = toCellKey(x, y);
        const current = cellHits.get(key) ?? [];
        current.push(color);
        cellHits.set(key, current);
    };

    const trace = (initial: BeamState[]) => {
        const splitterInputs = new Map<string, DirectionalInputs>();
        const adderInputs = new Map<string, LightColor[]>();
        const stateCounts = new Map<string, number>();
        const queue: BeamState[] = [...initial];

        while (queue.length > 0) {
            const beam = queue.shift()!;
            const delta = DELTA_BY_DIRECTION[beam.dir];
            const nx = beam.x + delta.x;
            const ny = beam.y + delta.y;
            if (!inBounds(nx, ny, width, height)) continue;

            const nextCellKey = toCellKey(nx, ny);
            segments.push({ x1: beam.x, y1: beam.y, x2: nx, y2: ny, color: beam.color });
            pushCellHit(nx, ny, beam.color);

            if (targetByCell.has(nextCellKey)) continue;
            if (emitterByCell.has(nextCellKey)) continue;

            const stateKey = `${nx},${ny},${beam.dir},${beam.color}`;
            const seen = stateCounts.get(stateKey) ?? 0;
            if (seen >= CELL_VISIT_LIMIT) continue;
            stateCounts.set(stateKey, seen + 1);

            const piece = pieceByCell.get(nextCellKey);
            if (!piece) {
                queue.push({ x: nx, y: ny, dir: beam.dir, color: beam.color });
                continue;
            }

            if (piece.type === "obstacle") continue;

            if (piece.type === "mirror") {
                queue.push({ x: nx, y: ny, dir: reflect(beam.dir, piece.orientation), color: beam.color });
                continue;
            }

            if (piece.type === "splitter" || piece.type === "mixer") {
                const current = splitterInputs.get(nextCellKey) ?? { colors: [], inputMask: 0 };
                current.colors.push(beam.color);
                current.inputMask |= directionBit(oppositeDirection(beam.dir));
                splitterInputs.set(nextCellKey, current);
                continue;
            }

            if (piece.type === "adder") {
                const current = adderInputs.get(nextCellKey) ?? [];
                current.push(beam.color);
                adderInputs.set(nextCellKey, current);
                continue;
            }
        }

        return { splitterInputs, adderInputs };
    };

    let frontier: BeamState[] = emitters.map((emitter) => ({ ...emitter }));
    const maxRounds = Math.max(16, width * height * 4);
    for (let round = 0; round < maxRounds && frontier.length > 0; round++) {
        const { splitterInputs, adderInputs } = trace(frontier);
        const nextFrontier: BeamState[] = [];

        for (const piece of pieces) {
            const key = toCellKey(piece.x, piece.y);
            if (piece.type === "splitter" || piece.type === "mixer") {
                const input = splitterInputs.get(key);
                if (!input || input.colors.length === 0) continue;
                const mixed = mixLightColors(input.colors);
                if (!mixed) continue;
                for (const dir of DIRECTION_ORDER) {
                    if ((input.inputMask & directionBit(dir)) !== 0) continue;
                    nextFrontier.push({ x: piece.x, y: piece.y, dir, color: mixed });
                }
                continue;
            }

            if (piece.type === "adder") {
                const input = adderInputs.get(key);
                if (!input || input.length === 0) continue;
                const mixed = mixLightColors(input);
                if (!mixed) continue;
                nextFrontier.push({ x: piece.x, y: piece.y, dir: piece.dir, color: mixed });
                continue;
            }
        }

        frontier = nextFrontier;
    }

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