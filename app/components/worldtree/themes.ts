export interface WorldTreeTheme {
    name: string;
    base: number;
    tip: number;
    leaf: number;
    pulse: number;
    darkSoil: number;
    lightSoil: number;
    grass: number;
    rock: number;
    skyTop: number;
    skyHorizon: number;
    skyBottom: number;
    fog: number;
    sunColor: number;
}

export const themes: WorldTreeTheme[] = [
    {
        name: "Pheonix",
        base: 0x4a3324, // Darker brown base
        tip: 0x335522,  // Darker green tip
        leaf: 0x44cc44, pulse: 0xaaffff,
        darkSoil: 0x3b2e25, lightSoil: 0x5c4433, grass: 0x226611, rock: 0x554433,
        skyTop: 0x004488, skyHorizon: 0x66ccff, skyBottom: 0x000510, fog: 0x66ccff,
        sunColor: 0xffffee
    },
    {
        name: "Autumn",
        base: 0x332211, tip: 0xcc5500, leaf: 0xffaa00, pulse: 0xffdd88,
        darkSoil: 0x2a1d15, lightSoil: 0x443322, grass: 0x885522, rock: 0x5a4a3a,
        skyTop: 0x441100, skyHorizon: 0xff8844, skyBottom: 0x110500, fog: 0xff8844,
        sunColor: 0xffaa00
    },
    {
        name: "Mystic",
        base: 0x110022, tip: 0x8800ff, leaf: 0xcc88ff, pulse: 0xff00ff,
        darkSoil: 0x100a18, lightSoil: 0x221133, grass: 0x440066, rock: 0x2a1a3a,
        skyTop: 0x110033, skyHorizon: 0x00ffff, skyBottom: 0x000000, fog: 0x00ffff,
        sunColor: 0x00ffff
    },
];
