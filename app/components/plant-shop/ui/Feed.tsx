"use client";

import { useGame } from "../game/store";

/** Transient messages: sales, purchases, level-ups. Entries expire in `game/progression.ts`. */
export function Feed() {
    const feed = useGame((s) => s.world.feed);
    return (
        <div className="ps-feed" aria-live="polite">
            {feed.map((entry) => (
                <div className={`ps-feed__item ps-feed__item--${entry.kind}`} key={entry.id}>
                    {entry.text}
                </div>
            ))}
        </div>
    );
}
