"use client";

import { useGame } from "../game/store";
import { getSpecies } from "../game/species";

/**
 * The seeds in the player's pocket. Selecting one arms it; the next click on an
 * empty pot plants it.
 */
export function SeedTray() {
    const seeds = useGame((s) => s.world.seeds);
    const selected = useGame((s) => s.world.selectedSeed);
    const selectSeed = useGame((s) => s.selectSeed);
    const setLocation = useGame((s) => s.setLocation);
    const held = Object.entries(seeds).filter(([, n]) => n > 0);

    return (
        <aside className="ps-tray">
            <h2 className="ps-tray__title">Seed pouch</h2>
            {held.length === 0 ? (
                <p className="ps-tray__empty">
                    No seeds. Head to the market to buy some.
                    <button type="button" className="ps-btn ps-btn--small" onClick={() => setLocation("market")}>
                        Go to Market
                    </button>
                </p>
            ) : (
                <ul className="ps-tray__list">
                    {held.map(([id, count]) => {
                        const species = getSpecies(id);
                        return (
                            <li key={id}>
                                <button
                                    type="button"
                                    className={`ps-seed ${selected === id ? "ps-seed--selected" : ""}`}
                                    onClick={() => selectSeed(id)}
                                    title={`${species.name} — sells for $${species.sellPrice}`}
                                >
                                    <span className="ps-seed__dot" style={{ background: species.palette.crown }} />
                                    <span className="ps-seed__name">{species.name}</span>
                                    <span className="ps-seed__count">×{count}</span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
            {selected && (
                <p className="ps-tray__hint">
                    Click an empty pot to plant <strong>{getSpecies(selected).name}</strong>.
                </p>
            )}
        </aside>
    );
}
