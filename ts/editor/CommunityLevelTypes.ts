import type { LaserLevelData } from "../utils/LaserLogic";

export type UserLevelRow = {
    id: string;
    owner_id: string;
    title: string;
    level_data: LaserLevelData;
    published: boolean;
    created_at?: string | null;
    updated_at?: string | null;
};

export type UserLevelDraft = {
    id: string | null;
    ownerId: string;
    title: string;
    document: LaserLevelData;
    published: boolean;
    updatedAt?: string;
};

export type ValidationIssue = {
    path: string;
    message: string;
};

export function createEmptyLevel(ownerId: string): UserLevelDraft {
    return {
        id: null,
        ownerId,
        title: "New Level",
        document: {
            title: "New Level",
            grid: { width: 8, height: 8 },
            emitters: [],
            targets: [],
            pieces: [],
            rules: { canPlaceOwnBlocks: false },
            metadata: {}
        },
        published: false
    };
}

export function normalizeUserLevel(row: UserLevelRow): UserLevelDraft {
    const document = structuredClone(row.level_data);
    const title = row.title;
    const grid = document.grid ?? {};

    document.title = title;
    document.grid = {
        width: Math.max(1, Math.floor(grid.width ?? 8)),
        height: Math.max(1, Math.floor(grid.height ?? 8))
    };
    document.emitters ??= [];
    document.targets ??= [];
    document.pieces ??= [];
    document.rules ??= {};
    document.metadata ??= {};

    return {
        id: row.id,
        ownerId: row.owner_id,
        title,
        document,
        published: row.published ?? false,
        updatedAt: row.updated_at ?? undefined
    };
}

export function validateUserLevel(level: UserLevelDraft): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const width = level.document.grid?.width ?? 0;
    const height = level.document.grid?.height ?? 0;
    const occupied = new Set<string>();

    if (!level.title.trim()) issues.push({ path: "title", message: "A title is required." });
    if (!Number.isInteger(width) || width < 2 || width > 32) {
        issues.push({ path: "grid.width", message: "Width must be an integer between 2 and 32." });
    }
    if (!Number.isInteger(height) || height < 2 || height > 32) {
        issues.push({ path: "grid.height", message: "Height must be an integer between 2 and 32." });
    }

    const checkCell = (x: number, y: number, path: string) => {
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= width || y >= height) {
            issues.push({ path, message: "Position is outside the grid." });
            return;
        }
        const key = `${x},${y}`;
        if (occupied.has(key)) issues.push({ path, message: "Multiple objects occupy the same cell." });
        occupied.add(key);
    };

    level.document.emitters?.forEach((item, index) => checkCell(item.x, item.y, `emitters.${index}`));
    level.document.targets?.forEach((item, index) => checkCell(item.x, item.y, `targets.${index}`));
    level.document.pieces?.forEach((item, index) => checkCell(item.x, item.y, `pieces.${index}`));
    if ((level.document.emitters?.length ?? 0) === 0) issues.push({ path: "emitters", message: "Add at least one emitter." });
    if ((level.document.targets?.length ?? 0) === 0) issues.push({ path: "targets", message: "Add at least one target." });

    return issues;
}