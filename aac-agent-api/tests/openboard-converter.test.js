import assert from "node:assert/strict";
import test from "node:test";
import { OpenBoardSchema } from "../src/schema/openboard.ts";
import { convertOpenBoard } from "../src/utils/openboard-converter.ts";

function draft(labels = ["Water", "Eat", "Hello"], grid = { rows: 2, columns: 2 }) {
	return OpenBoardSchema.parse({
		name: "Daily needs",
		description_html: "<p>Everyday words</p>",
		locale: "en",
		grid,
		buttons: labels.map((label) => ({
			label,
			image: { search_keyword: "glass of water" },
			actions: ["&water", ":speak"],
			action: ":home",
			vocalization: "Some water, please",
			background_color: "#ffffff",
			bold: true,
			top: 0.25,
			left: 0.5,
		})),
	});
}

test("conversion generates IDs with exact grid and image references", () => {
	const input = draft();
	const board = convertOpenBoard(input);
	const ids = [board.id, ...board.buttons.map((button) => button.id)];
	assert.ok(ids.every((id) => typeof id === "string" && id.length > 0));
	assert.equal(new Set(ids).size, 4);
	assert.equal(board.format, "open-board-0.1");
	assert.deepEqual(board.grid, {
		rows: 2, columns: 2,
		order: [[ids[1], ids[2]], [ids[3], null]],
	});
	assert.deepEqual(board.buttons.map((button) => button.image_id), ["Water", "Eat", "Hello"]);
	assert.deepEqual(board.images, ["Water", "Eat", "Hello"].map((id) => ({
		id, name: id, search_keyword: "glass of water", url: `/images/${id}.png`,
		width: 256, height: 256,
	})));
	const second = convertOpenBoard(input);
	assert.equal(new Set([...ids, second.id, ...second.buttons.map((button) => button.id)]).size, 8);
});

test("conversion preserves draft content and queries without mutating the input", () => {
	const input = draft();
	input.buttons[1].image.search_keyword = "person eating a meal";
	const before = structuredClone(input);
	const board = convertOpenBoard(input);
	assert.deepEqual(input, before);
	const { grid: _grid, buttons, ...content } = input;
	const { id: _id, format: _format, images, grid: _convertedGrid, buttons: convertedButtons, ...convertedContent } = board;
	assert.deepEqual(convertedContent, content);
	for (const [index, button] of buttons.entries()) {
		const { image, ...properties } = button;
		const { id: _id, image_id: _imageId, ...convertedProperties } = convertedButtons[index];
		assert.deepEqual(convertedProperties, properties);
		assert.equal("image" in convertedButtons[index], false);
		assert.equal(images[index].search_keyword, image.search_keyword);
		assert.equal(images[index].width, 256);
		assert.equal(images[index].height, 256);
	}
});

test("duplicate, suffixed, and missing labels have unique image IDs", () => {
	const board = convertOpenBoard(draft(
		[" Water ", "Water", "Water-2", null, "image-4", "   ", "__proto__"],
		{ rows: 2, columns: 4 },
	));
	const expected = ["Water", "Water-2", "Water-2-2", "image-4", "image-4-2", "image-6", "__proto__"];
	assert.deepEqual(board.images.map((image) => image.id), expected);
	assert.deepEqual(board.buttons.map((button) => button.image_id), expected);
	assert.deepEqual(board.images.map((image) => image.name), [
		"Water", "Water", "Water-2", "image-4", "image-4", "image-6", "__proto__",
	]);
});

test("placeholder URLs encode labels without changing image IDs", () => {
	const board = convertOpenBoard(draft(["水 / tea?#"], { rows: 1, columns: 1 }));
	assert.equal(board.images[0].id, "水 / tea?#");
	assert.equal(board.buttons[0].image_id, "水 / tea?#");
	assert.equal(board.images[0].url, "/images/%E6%B0%B4%20%2F%20tea%3F%23.png");
});

for (const [grid, order] of [
	[{ rows: 2, columns: 2 }, [[null, null], [null, null]]],
	[{ rows: 0, columns: 0 }, []],
	[{ rows: 2, columns: 0 }, [[], []]],
]) {
	test(`an empty ${grid.rows}x${grid.columns} board keeps its declared layout`, () => {
		const board = convertOpenBoard(draft([], grid));
		assert.deepEqual(board.grid.order, order);
		assert.deepEqual(board.buttons, []);
		assert.deepEqual(board.images, []);
	});
}

for (const grid of [
	{ rows: 101, columns: 100 },
	{ rows: 10_001, columns: 0 },
	{ rows: 0, columns: 10_001 },
]) {
	test(`oversized ${grid.rows}x${grid.columns} grids are rejected before allocation`, () => {
		assert.throws(() => convertOpenBoard(draft([], grid)), RangeError);
	});
}

test("a grid at the 10,000-cell limit is supported", () => {
	const board = convertOpenBoard(draft([], { rows: 100, columns: 100 }));
	assert.equal(board.grid.order.length, 100);
	assert.ok(board.grid.order.every((row) => row.length === 100 && row.every((cell) => cell === null)));
});

test("overflow is rejected instead of dropping buttons", () => {
	assert.throws(() => convertOpenBoard(draft(["Water", "Eat"], { rows: 1, columns: 1 })), RangeError);
	assert.throws(() => convertOpenBoard(draft(["Water"], { rows: 0, columns: 0 })), RangeError);
});
