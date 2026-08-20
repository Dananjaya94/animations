import type { PotSlot, Species } from "../types";

/**
 * The seed catalogue.
 *
 * Balance intent: each species trades one axis against another so the choice is
 * never just "buy the most expensive one I can afford".
 *   - marigold / basil: cheap, fast, thin margins. The tutorial crop.
 *   - tomato:   solid mid-game earner, moderately thirsty.
 *   - lavender: slow but forgiving, good when you want to step away.
 *   - aloe:     nearly zero upkeep (thirst 0.008 = ~2 minutes to dry out).
 *   - monstera: high value, long commitment.
 *   - orchid:   best margin in the game, but drains in ~25s. Demands attention.
 */
export const SPECIES: Species[] = [
    {
        id: "marigold",
        name: "Marigold",
        description: "Cheerful, fast, forgiving. Every shop starts here.",
        form: "flower",
        seedCost: 4,
        sellPrice: 11,
        growthSeconds: 35,
        thirst: 0.03,
        xp: 4,
        unlockLevel: 1,
        palette: { stem: "#4a7c3f", leaf: "#6aa84f", crown: "#f4a72c" }
    },
    {
        id: "basil",
        name: "Basil",
        description: "Kitchen staple. Sells steadily to anyone who cooks.",
        form: "herb",
        seedCost: 7,
        sellPrice: 18,
        growthSeconds: 50,
        thirst: 0.028,
        xp: 6,
        unlockLevel: 1,
        palette: { stem: "#3f6b34", leaf: "#7cb342", crown: "#9ccc65" }
    },
    {
        id: "chamomile",
        name: "Chamomile",
        description: "Tiny daisies, endlessly in demand. Drinks more than it looks like it should.",
        form: "flower",
        seedCost: 9,
        sellPrice: 24,
        growthSeconds: 60,
        thirst: 0.032,
        xp: 8,
        unlockLevel: 2,
        palette: { stem: "#5c8a4a", leaf: "#83b35f", crown: "#fdf3d0" }
    },
    {
        id: "tomato",
        name: "Tomato",
        description: "Heavy feeder, heavy drinker, heavy profits.",
        form: "fruit",
        seedCost: 12,
        sellPrice: 34,
        growthSeconds: 80,
        thirst: 0.025,
        xp: 12,
        unlockLevel: 2,
        palette: { stem: "#4c7a3a", leaf: "#6a9e4a", crown: "#e04b3a" }
    },
    {
        id: "lavender",
        name: "Lavender",
        description: "Slow to mature but barely thirsty. Plant it and go do something else.",
        form: "flower",
        seedCost: 18,
        sellPrice: 48,
        growthSeconds: 100,
        thirst: 0.018,
        xp: 18,
        unlockLevel: 3,
        palette: { stem: "#6b8f5e", leaf: "#8fbc8f", crown: "#9a7bc8" }
    },
    {
        id: "strawberry",
        name: "Strawberry",
        description: "Sweet, popular, and gone the moment you put it out.",
        form: "fruit",
        seedCost: 15,
        sellPrice: 40,
        growthSeconds: 90,
        thirst: 0.03,
        xp: 15,
        unlockLevel: 3,
        palette: { stem: "#4a7a3c", leaf: "#68a052", crown: "#d8354a" }
    },
    {
        id: "aloe",
        name: "Aloe",
        description: "Practically ignores you. Two full minutes before it wants water.",
        form: "succulent",
        seedCost: 26,
        sellPrice: 62,
        growthSeconds: 130,
        thirst: 0.008,
        xp: 26,
        unlockLevel: 4,
        palette: { stem: "#4f8a5b", leaf: "#6fbf7a", crown: "#7ab88a" }
    },
    {
        id: "fern",
        name: "Fern",
        description: "Wants damp air and constant attention. Bone dry in about twenty seconds.",
        form: "fern",
        seedCost: 22,
        sellPrice: 58,
        growthSeconds: 110,
        thirst: 0.048,
        xp: 20,
        unlockLevel: 4,
        palette: { stem: "#3d6b3a", leaf: "#4f8a45", crown: "#5d9c4e" }
    },
    {
        id: "monstera",
        name: "Monstera",
        description: "The houseplant everyone wants. Worth the wait.",
        form: "vine",
        seedCost: 40,
        sellPrice: 105,
        growthSeconds: 170,
        thirst: 0.022,
        xp: 45,
        unlockLevel: 5,
        palette: { stem: "#35603a", leaf: "#2f7d4f", crown: "#256b41" }
    },
    {
        id: "tulip",
        name: "Tulip",
        description: "A tidy cup of colour. Reliable money once you can grow it.",
        form: "bulb",
        seedCost: 34,
        sellPrice: 88,
        growthSeconds: 140,
        thirst: 0.02,
        xp: 32,
        unlockLevel: 5,
        palette: { stem: "#5d8f4f", leaf: "#77ab5e", crown: "#e0457b" }
    },
    {
        id: "bonsai",
        name: "Bonsai",
        description: "Decades of patience, compressed. Barely drinks, and sells for plenty.",
        form: "bonsai",
        seedCost: 55,
        sellPrice: 150,
        growthSeconds: 200,
        thirst: 0.012,
        xp: 55,
        unlockLevel: 6,
        palette: { stem: "#6b4f36", leaf: "#3f7a44", crown: "#356b3c" }
    },
    {
        id: "orchid",
        name: "Orchid",
        description: "Spectacular margins. Dries out in under half a minute. Do not wander off.",
        form: "flower",
        seedCost: 70,
        sellPrice: 190,
        growthSeconds: 220,
        thirst: 0.04,
        xp: 90,
        unlockLevel: 7,
        palette: { stem: "#5c8a63", leaf: "#7fae7f", crown: "#e668a7" }
    },
    {
        id: "bird-of-paradise",
        name: "Bird of Paradise",
        description: "The centrepiece of any shop. Thirsty, slow, and worth every second.",
        form: "bird",
        seedCost: 95,
        sellPrice: 265,
        growthSeconds: 260,
        thirst: 0.03,
        xp: 110,
        unlockLevel: 9,
        palette: { stem: "#4e7f4a", leaf: "#63a05a", crown: "#f0803a" }
    }
];

const BY_ID = new Map(SPECIES.map((s) => [s.id, s]));

/** Throws on unknown id — a bad species id is a bug, not a runtime condition. */
export function getSpecies(id: string): Species {
    const s = BY_ID.get(id);
    if (!s) throw new Error(`Unknown species: ${id}`);
    return s;
}

export const BENCH_TOP_Y = 0.75;

/** Pot positions across a table. Width is fixed; only depth grows. */
const COLUMNS = [-2.4, -1.2, 0, 1.2, 2.4];

/** z of the nearest table. */
const FIRST_TABLE_Z = 1.2;
const TABLE_SPACING = 1.9;
/** Clearance between the outermost tables and the end walls. */
const END_MARGIN = 1.7;
export const BENCH_WIDTH = 5.8;
export const BENCH_DEPTH = 1.1;

export function tableZ(table: number): number {
    return FIRST_TABLE_Z - table * TABLE_SPACING;
}

/** Front wall. Fixed, because tables grow away from the camera. */
export function greenhouseFrontZ(): number {
    return 2.9;
}

export function greenhouseBackZ(tables: number): number {
    return tableZ(tables - 1) - END_MARGIN;
}

export function greenhouseDepth(tables: number): number {
    return greenhouseFrontZ() - greenhouseBackZ(tables);
}

/** Middle of the building, for aiming the camera. */
export function greenhouseCenterZ(tables: number): number {
    return (greenhouseFrontZ() + greenhouseBackZ(tables)) / 2;
}

export function potSlot(index: number): PotSlot {
    const table = Math.floor(index / 5);
    const column = COLUMNS[index % 5];
    if (column === undefined || table >= 8) throw new Error(`No pot slot at index ${index}`);
    return { x: column, y: BENCH_TOP_Y, z: tableZ(table) };
}
