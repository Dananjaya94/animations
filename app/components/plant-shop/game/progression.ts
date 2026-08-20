import type { FeedKind, Plant, World } from "../types";
import { SPECIES, getSpecies } from "./species";

/**
 * The two progression tracks.
 *
 * **Levels** come from selling and unlock new *species*.
 * **Money** buys greenhouse expansions, which unlock *capacity*.
 *
 * They are deliberately separate: pots used to be handed out on level-up, which
 * meant capacity and variety advanced in lockstep and neither felt like a
 * decision. Now you choose when to reinvest.
 */

/** Total XP needed to advance *from* `level` to `level + 1`. */
export function xpToNextLevel(level: number): number {
    return Math.round(30 * Math.pow(level, 1.5));
}

/** Applies XP and rolls over as many levels as the amount earns. */
export function applyXp(level: number, xp: number, amount: number): { level: number; xp: number; gained: number } {
    let nextLevel = level;
    let nextXp = xp + amount;
    let gained = 0;
    while (nextXp >= xpToNextLevel(nextLevel)) {
        nextXp -= xpToNextLevel(nextLevel);
        nextLevel += 1;
        gained += 1;
    }
    return { level: nextLevel, xp: nextXp, gained };
}

/**
 * Cost of each expansion, in order. Index 0 buys the *second* table, since the
 * first comes with the greenhouse.
 *
 * Costs roughly double each step while a table's earning power only grows
 * linearly, so expanding stays a real decision rather than an obvious one.
 */
export const EXPANSIONS = [
    { table: 2, cost: 90, level: 2 },
    { table: 3, cost: 240, level: 3 },
    { table: 4, cost: 550, level: 4 },
    { table: 5, cost: 1100, level: 5 },
    { table: 6, cost: 2200, level: 7 },
    { table: 7, cost: 4200, level: 9 },
    { table: 8, cost: 7800, level: 11 }
];

export function potCapacity(tables: number): number {
    return Math.min(8, Math.max(0, tables)) * 5;
}

/** The expansion a player with `tables` benches would buy next, or null if full. */
export function nextExpansion(tables: number) {
    return EXPANSIONS[tables - 1] ?? null;
}

/** Below this moisture, growth starts slowing; at 0 it stops entirely. */
export const WILT_THRESHOLD = 0.25;
/** How long a feed message stays on screen, in sim-seconds. */
const FEED_LIFETIME = 6;
/**
 * Selectable speeds. Anything faster than 4x outruns the watering loop — plants
 * dry out quicker than you can plausibly click them.
 */
export const TIME_SCALES = [1, 2, 4];
/** Sale events are dropped after this long; the renderer only needs one frame. */
const SALE_LIFETIME = 2;

let feedCounter = 0;
let saleCounter = 0;

export function createWorld(): World {
    return {
        money: 25,
        xp: 0,
        level: 1,
        seeds: {},
        tables: 1,
        pots: Array.from({ length: 40 }, (_, id) => ({ id, plant: null })),
        location: "greenhouse",
        paused: false,
        timeScale: 1,
        elapsed: 0,
        selectedSeed: null,
        feed: [],
        sales: [],
        stats: { planted: 0, sold: 0, earned: 0 }
    };
}

export function unlockedPotCount(world: World): number {
    return potCapacity(world.tables);
}

export function isPotUnlocked(world: World, potId: number): boolean {
    return potId < unlockedPotCount(world);
}

export function seedCount(world: World, speciesId: string): number {
    return world.seeds[speciesId] ?? 0;
}

/**
 * Fraction of full growth speed at a given moisture level.
 * Full speed while comfortably watered, tapering linearly to a standstill at 0.
 */
export function growthRateAt(moisture: number): number {
    if (moisture <= 0) return 0;
    if (moisture >= 0.25) return 1;
    return moisture / WILT_THRESHOLD;
}

export function isReady(plant: Plant): boolean {
    return plant.growth >= 1;
}

function pushFeed(world: World, text: string, kind: FeedKind) {
    const entry = { id: ++feedCounter, text, kind, at: world.elapsed };
    return [...world.feed, entry].slice(-5);
}

/** Adds a message to the on-screen feed without otherwise changing the world. */
export function notify(world: World, text: string, kind: FeedKind = "info"): World {
    return { ...world, feed: pushFeed(world, text, kind) };
}

/**
 * Advances the world by `dt` sim-seconds. Callers are responsible for not
 * calling this while paused.
 *
 * Growth and moisture are integrated with a plain Euler step, which is fine at
 * the rates involved; `dt` is clamped by the caller to survive tab-switching.
 */
export function tickWorld(world: World, dt: number): World {
    if (dt <= 0) return world;
    let changed = false;
    const pots = world.pots.map((pot) => {
        const plant = pot.plant;
        if (!plant) return pot;
        const species = getSpecies(plant.speciesId);
        const moisture = Math.max(0, plant.moisture - species.thirst * dt);
        const growth = plant.growth >= 1 ? 1 : Math.min(1, plant.growth + (dt / species.growthSeconds) * growthRateAt(plant.moisture));
        if (growth === plant.growth && moisture === plant.moisture) return pot;
        changed = true;
        return { ...pot, plant: { ...plant, growth, moisture } };
    });
    const elapsed = world.elapsed + dt;
    const feed = world.feed.filter((f) => elapsed - f.at < FEED_LIFETIME);
    const sales = world.sales.filter((s) => elapsed - s.at < SALE_LIFETIME);
    const listsChanged = feed.length !== world.feed.length || sales.length !== world.sales.length;
    if (!changed && !listsChanged) return { ...world, elapsed };
    return { ...world, elapsed, pots, feed, sales };
}

export function setPaused(world: World, paused: boolean): World {
    if (world.paused === paused) return world;
    return { ...world, paused };
}

export function togglePaused(world: World): World {
    return { ...world, paused: !world.paused };
}

/** Ignores speeds that are not on the dial, so a bad save cannot wedge time. */
export function setTimeScale(world: World, timeScale: number): World {
    if (!TIME_SCALES.includes(timeScale)) return world;
    if (world.timeScale === timeScale) return world;
    return { ...world, timeScale, paused: false };
}

export function setLocation(world: World, location: World["location"]): World {
    if (world.location === location) return world;
    return { ...world, location };
}

export function selectSeed(world: World, speciesId: string): World {
    const next = world.selectedSeed === speciesId ? null : speciesId;
    if (next !== null && seedCount(world, next) <= 0) return world;
    return { ...world, selectedSeed: next };
}

export function buySeed(world: World, speciesId: string, qty = 1): World {
    const species = getSpecies(speciesId);
    if (species.unlockLevel > world.level) return world;
    const cost = species.seedCost * qty;
    if (cost > world.money) return { ...world, feed: pushFeed(world, `Not enough money for ${species.name}`, "bad") };
    const seeds = { ...world.seeds, [speciesId]: seedCount(world, speciesId) + qty };
    return {
        ...world,
        money: world.money - cost,
        seeds,
        selectedSeed: speciesId,
        feed: pushFeed(world, `Bought ${species.name} seed -$${cost}`, "info")
    };
}

/**
 * Buys the next bench. Refuses politely (with a message) when the player is
 * short of money or level, and silently when the greenhouse is already full.
 */
export function buyExpansion(world: World): World {
    const expansion = nextExpansion(world.tables);
    if (!expansion || world.tables >= 8) return world;
    if (world.level < expansion.level) return notify(world, `Table ${expansion.table} needs level ${expansion.level}`, "bad");
    if (world.money < expansion.cost) return notify(world, `Table ${expansion.table} costs $${expansion.cost}`, "bad");
    return notify(
        { ...world, money: world.money - expansion.cost, tables: world.tables + 1 },
        `Greenhouse extended — +5 pots`,
        "good"
    );
}

export function plantSeed(world: World, potId: number, speciesId: string): World {
    const pot = world.pots[potId];
    if (!pot || pot.plant) return world;
    if (!isPotUnlocked(world, potId)) return world;
    if (seedCount(world, speciesId) <= 0) return world;
    const species = getSpecies(speciesId);
    const remaining = seedCount(world, speciesId) - 1;
    const seeds = { ...world.seeds };
    if (remaining > 0) seeds[speciesId] = remaining;
    else delete seeds[speciesId];
    const pots = [...world.pots];
    pots[potId] = { ...pot, plant: { speciesId, growth: 0, moisture: 1, plantedAt: world.elapsed } };
    const next = {
        ...world,
        pots,
        seeds,
        selectedSeed: remaining > 0 ? speciesId : null,
        stats: { ...world.stats, planted: world.stats.planted + 1 }
    };
    return { ...next, feed: pushFeed(next, `Planted ${species.name}`, "info") };
}

export function waterPot(world: World, potId: number): World {
    const pot = world.pots[potId];
    if (!pot?.plant) return world;
    if (pot.plant.moisture >= 0.999) return world;
    const pots = [...world.pots];
    pots[potId] = { ...pot, plant: { ...pot.plant, moisture: 1 } };
    return { ...world, pots };
}

export function harvestPot(world: World, potId: number): World {
    const pot = world.pots[potId];
    if (!pot?.plant || !isReady(pot.plant)) return world;
    const species = getSpecies(pot.plant.speciesId);
    const pots = [...world.pots];
    pots[potId] = { ...pot, plant: null };
    const levelled = applyXp(world.level, world.xp, species.xp);
    const sale = { id: ++saleCounter, potId, amount: species.sellPrice, at: world.elapsed };
    let next: World = {
        ...world,
        pots,
        money: world.money + species.sellPrice,
        xp: levelled.xp,
        level: levelled.level,
        sales: [...world.sales, sale],
        stats: {
            ...world.stats,
            sold: world.stats.sold + 1,
            earned: world.stats.earned + species.sellPrice
        }
    };
    next = { ...next, feed: pushFeed(next, `Sold ${species.name} +$${species.sellPrice}`, "good") };
    if (levelled.gained > 0) {
        const unlocked = SPECIES.filter((s) => s.unlockLevel > world.level && s.unlockLevel <= levelled.level);
        const suffix = unlocked.length > 0 ? ` — ${unlocked.map((s) => s.name).join(", ")} unlocked!` : "";
        next = { ...next, feed: pushFeed(next, `Level ${levelled.level}!${suffix}`, "good") };
    }
    return next;
}

/**
 * A single click on a pot, resolved contextually:
 *   mature plant -> sell it
 *   growing plant -> top up its water
 *   empty pot + armed seed -> plant it
 */
export function clickPot(world: World, potId: number): World {
    if (!isPotUnlocked(world, potId)) return world;
    const pot = world.pots[potId];
    if (!pot) return world;
    if (pot.plant) return isReady(pot.plant) ? harvestPot(world, potId) : waterPot(world, potId);
    if (world.selectedSeed) return plantSeed(world, potId, world.selectedSeed);
    return world;
}
