"use client";

import { useGame } from "../game/store";
import { SPECIES } from "../game/species";

/** Turns a thirst rate into something a player can actually reason about. */
function waterWord(thirst: number): string {
    const secondsToDry = Math.round(1 / thirst);
    if (secondsToDry >= 100) return "barely needs water";
    if (secondsToDry >= 45) return "low upkeep";
    if (secondsToDry >= 30) return "water regularly";
    return "very thirsty";
}

/** The market's price list. Mirrors what clicking the 3D crates does. */
export function MarketPanel() {
    const money = useGame((s) => s.world.money);
    const level = useGame((s) => s.world.level);
    const seeds = useGame((s) => s.world.seeds);
    const buySeed = useGame((s) => s.buySeed);

    return (
        <aside className="ps-market">
            <h2 className="ps-market__title">Seed stall</h2>
            <p className="ps-market__hint">Click a crate, or buy from the list.</p>
            <ul className="ps-market__list">
                {SPECIES.map((s) => {
                    const locked = s.unlockLevel > level;
                    const tooDear = s.seedCost > money;
                    const held = seeds[s.id] ?? 0;
                    return (
                        <li className={`ps-offer ${locked ? "ps-offer--locked" : ""}`} key={s.id}>
                            <span className="ps-offer__dot" style={{ background: s.palette.crown }} />
                            <div className="ps-offer__body">
                                <div className="ps-offer__head">
                                    <strong>{s.name}</strong>
                                    {held > 0 && <span className="ps-offer__held">×{held} held</span>}
                                </div>
                                <p className="ps-offer__desc">{s.description}</p>
                                <p className="ps-offer__meta">
                                    Sells ${s.sellPrice} · {s.growthSeconds}s to grow · {waterWord(s.thirst)}
                                </p>
                            </div>
                            <button
                                type="button"
                                className="ps-btn ps-btn--buy"
                                disabled={locked || tooDear}
                                onClick={() => buySeed(s.id)}
                                title={locked ? `Unlocks at level ${s.unlockLevel}` : `Buy for $${s.seedCost}`}
                            >
                                {locked ? `Lv ${s.unlockLevel}` : `$${s.seedCost}`}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </aside>
    );
}
