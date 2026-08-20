"use client";

import dynamic from "next/dynamic";

/**
 * The game's store reads localStorage at module-evaluation time (the
 * autosave load), which does not exist during server rendering. Loading it
 * only on the client sidesteps that instead of threading `typeof window`
 * guards through the save/store modules.
 */
const PlantShop = dynamic(() => import("./plantshop"), { ssr: false });

export default function PlantShopPage() {
    return (
        <div style={{ width: '100', height: 'calc(100vh - 48px)', position: 'relative' }}>
            <PlantShop />
        </div>
    );
}
