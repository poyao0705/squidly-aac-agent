import type { OpenBoard } from "../schema/openboard.js";

const MAX_GRID_SIZE = 10_000;

export type ConvertedOpenBoard = Omit<OpenBoard, "grid" | "buttons"> & {
	id: string;
	format: "open-board-0.1";
	grid: OpenBoard["grid"] & { order: (string | null)[][] };
	buttons: (Omit<OpenBoard["buttons"][number], "image"> & {
		id: string;
		image_id: string;
	})[];
	images: {
		id: string;
		name: string;
		search_keyword: string;
		url: string;
		width: number;
		height: number;
	}[];
};

function newID(): string {
	return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

function getImageUrl(imageId: string): string {
	// shortcut: URLs are placeholder paths; replace with asset lookup when image retrieval is implemented.
	return `/images/${encodeURIComponent(imageId)}.png`;
}

export function convertOpenBoard(draft: OpenBoard): ConvertedOpenBoard {
	const { rows, columns } = draft.grid;
	// Bound each axis too: zero-column grids can still allocate rows.
	if (
		rows > MAX_GRID_SIZE ||
		columns > MAX_GRID_SIZE ||
		rows * columns > MAX_GRID_SIZE
	) {
		throw new RangeError(
			"Board grid exceeds the 10,000-cell or per-axis limit",
		);
	}
	if (draft.buttons.length > rows * columns) {
		throw new RangeError("Board contains more buttons than grid cells");
	}

	const images: ConvertedOpenBoard["images"] = [];
	const imageIds = new Set<string>();
	const buttons = draft.buttons.map(({ image, ...button }, index) => {
		const name = button.label?.trim() || `image-${index + 1}`;
		let imageId = name;
		let suffix = 2;
		while (imageIds.has(imageId)) {
			imageId = `${name}-${suffix++}`;
		}
		imageIds.add(imageId);
		images.push({
			id: imageId,
			name,
			search_keyword: image.search_keyword,
			url: getImageUrl(imageId),
			width: 256,
			height: 256,
		});
		return { ...button, id: newID(), image_id: imageId };
	});

	return {
		...draft,
		id: newID(),
		format: "open-board-0.1",
		buttons,
		images,
		grid: {
			...draft.grid,
			order: Array.from({ length: rows }, (_, row) =>
				Array.from(
					{ length: columns },
					(_, column) => buttons[row * columns + column]?.id ?? null,
				),
			),
		},
	};
}
