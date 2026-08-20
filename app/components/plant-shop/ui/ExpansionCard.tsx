"use client";

import { useGame } from "../game/store";
import { EXPANSIONS, nextExpansion, potCapacity } from "../game/progression";

/** Buying the next bench. Sits under the seed pouch in the greenhouse view. */
export function ExpansionCard() {
    const tables = useGame((s) => s.world.tables);
    const money = useGame((s) => s.world.money);
    const level = useGame((s) => s.world.level);
    const buyExpansion = useGame((s) => s.buyExpansion);
    const next = nextExpansion(tables);
    const capacity = potCapacity(tables);

    return (
        <aside className="ps-expand">
            <h2 className="ps-expand__title">Greenhouse</h2>
            <p className="ps-expand__now">
                {tables} table{tables === 1 ? "" : "s"} · {capacity} pots
            </p>
            {next ? (
                <>
                    <div className="ps-expand__row">
                        <span className="ps-expand__gain">
                            +5 pots
                            <span className="ps-expand__sub">table {next.table}</span>
                        </span>
                        <button
                            type="button"
                            className="ps-btn ps-btn--buy"
                            disabled={level < next.level || money < next.cost}
                            onClick={buyExpansion}
                            title={level < next.level ? `Unlocks at level ${next.level}` : `Extend the greenhouse for $${next.cost}`}
                        >
                            {level < next.level ? `Lv ${next.level}` : `$${next.cost}`}
                        </button>
                    </div>
                    <p className="ps-expand__hint">
                        {level < next.level
                            ? `Reach level ${next.level} to build this.`
                            : money < next.cost
                              ? `$${next.cost - money} more to go.`
                              : "The greenhouse extends out into the meadow."}
                    </p>
                </>
            ) : (
                <p className="ps-expand__hint">Fully built — all {EXPANSIONS.length + 1} tables. Nothing left to add.</p>
            )}
        </aside>
    );
}
