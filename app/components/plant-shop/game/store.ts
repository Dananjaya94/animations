import { create, type StoreApi } from "zustand";
import type { World } from "../types";
import {
    buyExpansion,
    buySeed,
    clickPot,
    createWorld,
    notify,
    selectSeed,
    setLocation,
    setPaused,
    setTimeScale,
    tickWorld,
    togglePaused
} from "./progression";
import {
    clearAutosave,
    deleteSlot,
    loadAutosave,
    loadFromSlot,
    saveToSlot,
    scheduleAutosave,
    writeAutosaveNow
} from "./saves";

/**
 * The single source of truth for the running game.
 *
 * Read it two different ways depending on what you are building:
 *
 *  - **UI (React)**: subscribe with a narrow selector, e.g.
 *    `useGame((s) => s.world.money)`. These values change only on discrete
 *    events, so the HUD stays quiet during normal play.
 *
 *  - **3D (useFrame)**: do *not* subscribe. Call `useGame.getState()` inside the
 *    frame loop and drive meshes imperatively. Plant growth changes every tick;
 *    subscribing to it would re-render the scene graph continuously.
 */

/** Largest step we will ever simulate at once, in seconds. */
const MAX_STEP = 0.25;

export interface GameState {
    world: World;
    saveRevision: number;
    advance: (dt: number) => void;
    clickPot: (potId: number) => void;
    buySeed: (speciesId: string, qty?: number) => void;
    buyExpansion: () => void;
    selectSeed: (speciesId: string) => void;
    setLocation: (location: World["location"]) => void;
    togglePaused: () => void;
    setPaused: (paused: boolean) => void;
    setTimeScale: (timeScale: number) => void;
    saveToSlot: (slot: number) => void;
    loadFromSlot: (slot: number) => void;
    deleteSlot: (slot: number) => void;
    reset: () => void;
}

/** Wraps a pure world action so every mutation goes through one place. */
function apply(set: StoreApi<GameState>["setState"], fn: (world: World) => World) {
    set((s) => {
        const world = fn(s.world);
        if (world === s.world) return {};
        scheduleAutosave(world);
        return { world };
    });
}

export const useGame = create<GameState>((set, get) => ({
    world: loadAutosave(),
    saveRevision: 0,
    advance: (dt) =>
        set((s) => {
            if (s.world.paused) return {};
            const world = tickWorld(s.world, Math.min(dt, MAX_STEP) * s.world.timeScale);
            if (world === s.world) return {};
            scheduleAutosave(world);
            return { world };
        }),
    clickPot: (potId) => apply(set, (w) => clickPot(w, potId)),
    buySeed: (speciesId, qty = 1) => apply(set, (w) => buySeed(w, speciesId, qty)),
    buyExpansion: () => apply(set, (w) => buyExpansion(w)),
    selectSeed: (speciesId) => apply(set, (w) => selectSeed(w, speciesId)),
    setLocation: (location) => apply(set, (w) => setLocation(w, location)),
    togglePaused: () => apply(set, (w) => togglePaused(w)),
    setPaused: (paused) => apply(set, (w) => setPaused(w, paused)),
    setTimeScale: (timeScale) => apply(set, (w) => setTimeScale(w, timeScale)),
    saveToSlot: (slot) => {
        const ok = saveToSlot(slot, get().world);
        set((s) => ({
            saveRevision: s.saveRevision + 1,
            world: notify(s.world, ok ? `Saved to slot ${slot + 1}` : "Could not save — storage unavailable", ok ? "good" : "bad")
        }));
    },
    loadFromSlot: (slot) => {
        const world = loadFromSlot(slot);
        if (!world) {
            set((s) => ({ world: notify(s.world, "That slot is empty", "bad") }));
            return;
        }
        writeAutosaveNow(world);
        set({ world: notify(world, `Loaded slot ${slot + 1}`, "good") });
    },
    deleteSlot: (slot) => {
        deleteSlot(slot);
        set((s) => ({ saveRevision: s.saveRevision + 1 }));
    },
    reset: () => {
        clearAutosave();
        set({ world: createWorld() });
    }
}));
