"use client";

import { useEffect, useState } from "react";
import { useGame } from "./game/store";
import { TIME_SCALES } from "./game/progression";
import { GameCanvas } from "./three/GameCanvas";
import { Hud } from "./ui/Hud";
import { SaveMenu } from "./ui/SaveMenu";
import { SeedTray } from "./ui/SeedTray";
import { MarketPanel } from "./ui/MarketPanel";
import { ExpansionCard } from "./ui/ExpansionCard";
import { Feed } from "./ui/Feed";
import "./plantshop.css";

export function App() {
    const location = useGame((s) => s.world.location);
    const paused = useGame((s) => s.world.paused);
    const togglePaused = useGame((s) => s.togglePaused);
    const setPaused = useGame((s) => s.setPaused);
    const setTimeScale = useGame((s) => s.setTimeScale);
    const reset = useGame((s) => s.reset);
    const [savesOpen, setSavesOpen] = useState(false);

    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            if (e.repeat) return;
            const target = e.target;
            if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]')) return;
            if (e.code === "Space") {
                e.preventDefault();
                togglePaused();
                return;
            }
            const index = ["Digit1", "Digit2", "Digit3"].indexOf(e.code);
            const scale = index >= 0 ? TIME_SCALES[index] : undefined;
            if (scale !== undefined) {
                e.preventDefault();
                setTimeScale(scale);
            }
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [togglePaused, setTimeScale]);

    useEffect(() => {
        function onVisibility() {
            if (document.hidden) setPaused(true);
        }
        document.addEventListener("visibilitychange", onVisibility);
        return () => document.removeEventListener("visibilitychange", onVisibility);
    }, [setPaused]);

    return (
        <div className="ps-app">
            <GameCanvas />
            <div className="ps-overlay">
                <Hud onOpenSaves={() => setSavesOpen(true)} />
                <div className="ps-overlay__side">
                    {location === "greenhouse" ? (
                        <div className="ps-sidestack">
                            <SeedTray />
                            <ExpansionCard />
                        </div>
                    ) : (
                        <MarketPanel />
                    )}
                </div>
                <Feed />
                <footer className="ps-footer">
                    <span>Drag to orbit · scroll to zoom · click a pot to plant, water or sell</span>
                    <button
                        type="button"
                        className="ps-btn ps-btn--ghost ps-btn--small"
                        onClick={() => {
                            if (window.confirm("Start over? This erases your shop.")) reset();
                        }}
                    >
                        Reset
                    </button>
                </footer>
            </div>
            {savesOpen && <SaveMenu onClose={() => setSavesOpen(false)} />}
            {paused && !savesOpen && (
                <div className="ps-paused" onClick={togglePaused}>
                    <div className="ps-paused__card">
                        <span className="ps-paused__title">Paused</span>
                        <span className="ps-paused__hint">Press Space or click to resume</span>
                        <span className="ps-paused__hint">1 / 2 / 3 set the speed</span>
                    </div>
                </div>
            )}
        </div>
    );
}
