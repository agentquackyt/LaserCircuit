import { describe, expect, test } from "bun:test";
import { mixLightColors, simulateLaserLevel, type Emitter, type LaserPiece, type Target } from "./LaserLogic";

describe("mixLightColors", () => {
	test("mixes red and blue into purple", () => {
		expect(mixLightColors(["red", "blue"])).toBe("purple");
	});
});

describe("simulateLaserLevel", () => {
	test("adder emits purple when red and blue meet", () => {
		const emitters: Emitter[] = [
			{ x: 0, y: 4, dir: "right", color: "red" },
			{ x: 4, y: 8, dir: "up", color: "blue" },
		];
		const pieces: LaserPiece[] = [{ type: "adder", x: 4, y: 4, dir: "right" }];
		const targets: Target[] = [{ x: 8, y: 4, color: "purple" }];

		const result = simulateLaserLevel(9, 9, emitters, pieces, targets);
		expect(result.solved).toBe(true);
		expect(result.targetHits).toEqual([true]);
	});

	test("horizontal splitter lights two side targets", () => {
		const emitters: Emitter[] = [{ x: 4, y: 0, dir: "down", color: "blue" }];
		const pieces: LaserPiece[] = [{ type: "splitter", x: 4, y: 4, orientation: "horizontal" }];
		const targets: Target[] = [
			{ x: 1, y: 4, color: "blue" },
			{ x: 7, y: 4, color: "blue" },
		];

		const result = simulateLaserLevel(9, 9, emitters, pieces, targets);
		expect(result.targetHits).toEqual([true, true]);
		expect(result.solved).toBe(true);
	});
});
