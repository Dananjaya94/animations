"use client";

import { useEffect, useState } from "react";
import { useGame } from "../game/store";
import { listSlots } from "../game/saves";

/** Formats a save timestamp as something a person can scan quickly. */
function when(ms: number): string {
    if (!ms) return "unknown time";
    return new Date(ms).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

type Pending = { slot: number; kind: "save" | "load" } | null;

export function SaveMenu({ onClose }: { onClose: () => void }) {
    const saveToSlot = useGame((s) => s.saveToSlot);
    const loadFromSlot = useGame((s) => s.loadFromSlot);
    const deleteSlot = useGame((s) => s.deleteSlot);
    // Subscribing to saveRevision (unused otherwise) forces this modal to
    // re-render — and so re-read the slots from localStorage — after a save,
    // load, or delete.
    useGame((s) => s.saveRevision);
    const slots = listSlots();
    const [confirming, setConfirming] = useState<Pending>(null);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div className="ps-modal" onClick={onClose}>
            <div className="ps-modal__card" onClick={(e) => e.stopPropagation()}>
                <div className="ps-modal__head">
                    <h2>Save &amp; load</h2>
                    <button type="button" className="ps-btn ps-btn--ghost ps-btn--small" onClick={onClose}>
                        Close
                    </button>
                </div>
                <p className="ps-modal__note">Your shop autosaves as you play. These three slots are manual snapshots you can come back to.</p>
                <ul className="ps-slots">
                    {Array.from({ length: 3 }, (_, i) => {
                        const summary = slots[i] ?? null;
                        const pending = confirming?.slot === i ? confirming.kind : null;
                        return (
                            <li className="ps-slot" key={i}>
                                <div className="ps-slot__body">
                                    <strong className="ps-slot__name">Slot {i + 1}</strong>
                                    {summary ? (
                                        <>
                                            <span className="ps-slot__stats">
                                                Level {summary.level} · ${summary.money} · {summary.plants} planted
                                            </span>
                                            <span className="ps-slot__time">{when(summary.savedAt)}</span>
                                        </>
                                    ) : (
                                        <span className="ps-slot__stats ps-slot__stats--empty">Empty</span>
                                    )}
                                </div>
                                {pending ? (
                                    <div className="ps-slot__actions">
                                        <span className="ps-slot__confirm">{pending === "save" ? "Overwrite?" : "Lose current progress?"}</span>
                                        <button
                                            type="button"
                                            className="ps-btn ps-btn--small ps-btn--warn"
                                            onClick={() => {
                                                if (pending === "save") saveToSlot(i);
                                                else loadFromSlot(i);
                                                setConfirming(null);
                                                onClose();
                                            }}
                                        >
                                            Yes
                                        </button>
                                        <button type="button" className="ps-btn ps-btn--small ps-btn--ghost" onClick={() => setConfirming(null)}>
                                            No
                                        </button>
                                    </div>
                                ) : (
                                    <div className="ps-slot__actions">
                                        <button
                                            type="button"
                                            className="ps-btn ps-btn--small ps-btn--primary"
                                            onClick={() => {
                                                if (summary) setConfirming({ slot: i, kind: "save" });
                                                else {
                                                    saveToSlot(i);
                                                    onClose();
                                                }
                                            }}
                                        >
                                            Save
                                        </button>
                                        <button
                                            type="button"
                                            className="ps-btn ps-btn--small"
                                            disabled={!summary}
                                            onClick={() => setConfirming({ slot: i, kind: "load" })}
                                        >
                                            Load
                                        </button>
                                        <button
                                            type="button"
                                            className="ps-btn ps-btn--small ps-btn--ghost"
                                            disabled={!summary}
                                            onClick={() => deleteSlot(i)}
                                            title="Delete this save"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
