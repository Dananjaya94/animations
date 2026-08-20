"use client";

import { useGame } from "../game/store";
import { potCapacity, TIME_SCALES, xpToNextLevel } from "../game/progression";

/**
 * Top bar: money, level, XP progress, time controls.
 *
 * The controls are icon-only with tooltips rather than labelled buttons — there
 * are five of them now, and spelled out they crowded the bar. `data-tip` drives
 * a CSS tooltip; `aria-label` carries the same text for screen readers.
 */

/** Icons per speed, so 2x and 4x are distinguishable at a glance. */
const SPEED_ICON: Record<number, string> = { 1: "▶", 2: "▶▶", 4: "▶▶▶" };
const SPEED_TIP: Record<number, string> = { 1: "Normal speed", 2: "Double speed", 4: "Quadruple speed" };

function IconButton({
    icon,
    tip,
    hotkey,
    active,
    onClick
}: {
    icon: string;
    tip: string;
    hotkey?: string;
    active?: boolean;
    onClick: () => void;
}) {
    const label = hotkey ? `${tip} (${hotkey})` : tip;
    return (
        <button
            type="button"
            className={`ps-iconbtn ${active ? "ps-iconbtn--active" : ""}`}
            onClick={onClick}
            data-tip={label}
            aria-label={label}
            aria-pressed={active ?? false}
        >
            {icon}
        </button>
    );
}

export function Hud({ onOpenSaves }: { onOpenSaves: () => void }) {
    const money = useGame((s) => s.world.money);
    const level = useGame((s) => s.world.level);
    const xp = useGame((s) => s.world.xp);
    const tables = useGame((s) => s.world.tables);
    const paused = useGame((s) => s.world.paused);
    const timeScale = useGame((s) => s.world.timeScale);
    const location = useGame((s) => s.world.location);
    const togglePaused = useGame((s) => s.togglePaused);
    const setTimeScale = useGame((s) => s.setTimeScale);
    const setLocation = useGame((s) => s.setLocation);
    const needed = xpToNextLevel(level);
    const pct = Math.min(100, (xp / needed) * 100);

    return (
        <header className="ps-hud">
            <div className="ps-hud__stat ps-hud__stat--money">
                <span className="ps-hud__label">Money</span>
                <span className="ps-hud__value">${money}</span>
            </div>
            <div className="ps-hud__stat ps-hud__level">
                <span className="ps-hud__label">Level {level}</span>
                <div className="ps-xpbar" role="progressbar" aria-valuenow={xp} aria-valuemax={needed}>
                    <div className="ps-xpbar__fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="ps-hud__sub">
                    {xp} / {needed} xp · {potCapacity(tables)} pots
                </span>
            </div>
            <div className="ps-hud__actions">
                <div className="ps-timectl" role="group" aria-label="Time controls">
                    <IconButton icon={paused ? "▶" : "⏸"} tip={paused ? "Resume" : "Pause"} hotkey="Space" active={paused} onClick={togglePaused} />
                    <span className="ps-timectl__divider" aria-hidden="true" />
                    {TIME_SCALES.map((scale, i) => (
                        <IconButton
                            key={scale}
                            icon={SPEED_ICON[scale] ?? `${scale}x`}
                            tip={SPEED_TIP[scale] ?? `${scale}x speed`}
                            hotkey={String(i + 1)}
                            active={!paused && timeScale === scale}
                            onClick={() => setTimeScale(scale)}
                        />
                    ))}
                </div>
                <IconButton icon="💾" tip="Save and load" onClick={onOpenSaves} />
                {location === "greenhouse" ? (
                    <button type="button" className="ps-btn ps-btn--primary" onClick={() => setLocation("market")}>
                        Go to Market
                    </button>
                ) : (
                    <button type="button" className="ps-btn ps-btn--primary" onClick={() => setLocation("greenhouse")}>
                        Back to Greenhouse
                    </button>
                )}
            </div>
        </header>
    );
}
