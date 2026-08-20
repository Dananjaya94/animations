export type PlantForm =
    | "flower" | "herb" | "fruit" | "succulent" | "vine" | "fern" | "bulb" | "bonsai" | "bird";

export interface SpeciesPalette {
    stem: string;
    leaf: string;
    crown: string;
}

export interface Species {
    id: string;
    name: string;
    description: string;
    form: PlantForm;
    seedCost: number;
    sellPrice: number;
    growthSeconds: number;
    thirst: number;
    xp: number;
    unlockLevel: number;
    palette: SpeciesPalette;
}

export interface Plant {
    speciesId: string;
    growth: number;
    moisture: number;
    plantedAt: number;
}

export interface Pot {
    id: number;
    plant: Plant | null;
}

export type FeedKind = "info" | "good" | "bad";

export interface FeedEntry {
    id: number;
    text: string;
    kind: FeedKind;
    at: number;
}

export interface SaleEvent {
    id: number;
    potId: number;
    amount: number;
    at: number;
}

export type Location = "greenhouse" | "market";

export interface WorldStats {
    planted: number;
    sold: number;
    earned: number;
}

export interface World {
    money: number;
    xp: number;
    level: number;
    seeds: Record<string, number>;
    tables: number;
    pots: Pot[];
    location: Location;
    paused: boolean;
    timeScale: number;
    elapsed: number;
    selectedSeed: string | null;
    feed: FeedEntry[];
    sales: SaleEvent[];
    stats: WorldStats;
}

export interface SaveFile {
    version: 2;
    savedAt: number;
    world: World;
}

export interface SlotSummary {
    slot: number;
    savedAt: number;
    level: number;
    money: number;
    plants: number;
}

export interface PotSlot {
    x: number;
    y: number;
    z: number;
}

/** A rectangular footprint on the ground plane, in world XZ coordinates. */
export interface RectArea {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
}

/** A `RectArea` plus how far beyond its edges the terrain eases back to its natural height. */
export interface PadArea extends RectArea {
    falloff: number;
}
