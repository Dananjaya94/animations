import type { SaveFile, SlotSummary, World } from "../types";
import { createWorld } from "./progression";

/**
 * All persistence lives here. Nothing else in the codebase touches localStorage.
 *
 * There are two kinds of save:
 *   - the **autosave**, written continuously while playing and loaded on boot;
 *   - three **manual slots**, written and read only when the player asks.
 *
 * Every read is defensive. A save is user-modifiable data on disk that may have
 * been written by an older version of the game, so a bad one must degrade to
 * "no save" rather than throwing on startup.
 */

const AUTOSAVE_KEY = "plant-shop:save";
const slotKey = (slot: number) => `plant-shop:slot:${slot}`;

/** The shape of whatever was actually in localStorage — not trusted until checked. */
interface RawSave {
    version?: number;
    savedAt?: number;
    world?: Partial<World> & Record<string, unknown>;
}

/**
 * Brings an older save up to the current shape.
 *
 * Runs on data that may predate a field entirely, so it works off what is
 * actually present rather than trusting the merged defaults.
 *
 * - **Pot array length.** `MAX_POTS` grows when tables are added, and an old
 *   save's shorter array would leave holes where new pots should be.
 * - **Table count.** Saves written before expansions existed had pots granted by
 *   level instead. Those players keep every pot they had: we buy them, for free,
 *   however many tables it takes to cover their highest occupied slot.
 */
function migrate(world: World, raw: Partial<World> & Record<string, unknown>): World {
    const pots = Array.from({ length: 40 }, (_, id) => world.pots[id] ?? { id, plant: null });
    let tables = world.tables;
    if (raw.tables === undefined) {
        const highestUsed = pots.reduce((max, pot, i) => (pot.plant ? i : max), -1);
        const needed = Math.ceil((highestUsed + 1) / 5);
        tables = Math.max(1, needed);
    }
    return { ...world, pots, tables: Math.min(8, Math.max(1, tables)) };
}

function read(key: string): SaveFile | null {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as RawSave;
        if (parsed?.version !== 2 || !parsed.world) return null;
        const merged: World = { ...createWorld(), ...parsed.world, feed: [], sales: [], paused: false };
        return {
            version: 2,
            savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0,
            world: migrate(merged, parsed.world)
        };
    } catch {
        return null;
    }
}

function write(key: string, world: World): boolean {
    try {
        const payload = { version: 2, savedAt: Date.now(), world };
        localStorage.setItem(key, JSON.stringify(payload));
        return true;
    } catch {
        return false;
    }
}

export function loadAutosave(): World {
    return read(AUTOSAVE_KEY)?.world ?? createWorld();
}

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingWorld: World | null = null;

/**
 * Debounced to at most once a second, since the sim calls this every tick.
 *
 * The pending world is *replaced* on every call rather than captured by the
 * first one. Capturing would mean a burst of calls all resolve to whichever
 * world happened to start the timer — up to a second of play silently lost.
 */
export function scheduleAutosave(world: World): void {
    pendingWorld = world;
    if (autosaveTimer !== null) return;
    autosaveTimer = setTimeout(() => {
        autosaveTimer = null;
        if (pendingWorld) write(AUTOSAVE_KEY, pendingWorld);
        pendingWorld = null;
    }, 1000);
}

function cancelPendingAutosave(): void {
    if (autosaveTimer !== null) clearTimeout(autosaveTimer);
    autosaveTimer = null;
    pendingWorld = null;
}

/**
 * Writes the autosave immediately, dropping anything already queued.
 *
 * Used after loading a slot and on reset. Going through `scheduleAutosave`
 * instead would let an in-flight write from the *previous* game land a moment
 * later and quietly overwrite the game you just loaded.
 */
export function writeAutosaveNow(world: World): void {
    cancelPendingAutosave();
    write(AUTOSAVE_KEY, world);
}

export function clearAutosave(): void {
    cancelPendingAutosave();
    try {
        localStorage.removeItem(AUTOSAVE_KEY);
    } catch {
        // Storage unavailable — nothing to clear.
    }
}

export function saveToSlot(slot: number, world: World): boolean {
    return write(slotKey(slot), world);
}

export function loadFromSlot(slot: number): World | null {
    return read(slotKey(slot))?.world ?? null;
}

export function deleteSlot(slot: number): void {
    try {
        localStorage.removeItem(slotKey(slot));
    } catch {
        // Storage unavailable — nothing to delete.
    }
}

function summariseSlot(slot: number): SlotSummary | null {
    const file = read(slotKey(slot));
    if (!file) return null;
    return {
        slot,
        savedAt: file.savedAt,
        level: file.world.level,
        money: file.world.money,
        plants: file.world.pots.filter((p) => p.plant).length
    };
}

export function listSlots(): (SlotSummary | null)[] {
    return Array.from({ length: 3 }, (_, i) => summariseSlot(i));
}
