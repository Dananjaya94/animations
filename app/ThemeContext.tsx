'use client';

import React, { createContext, useContext, useState, useMemo } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

type ThemeContextType = {
    mode: 'light' | 'dark';
    toggleColorMode: () => void;
};

const ColorModeContext = createContext<ThemeContextType>({
    mode: 'light',
    toggleColorMode: () => { },
});

export const useColorMode = () => useContext(ColorModeContext);

export default function ThemeContextProvider({ children }: { children: React.ReactNode }) {
    const [mode, setMode] = useState<'light' | 'dark'>('dark');

    const colorMode = useMemo(
        () => ({
            mode,
            toggleColorMode: () => {
                setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
            },
        }),
        [mode]
    );

    const theme = useMemo(
        () =>
            createTheme({
                // ✅ MOVED FROM theme.ts: Keep your font settings
                typography: {
                    fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
                },
                palette: {
                    mode,
                    ...(mode === 'dark'
                        ? {
                            // Dark Mode Colors
                            background: { default: '#050508', paper: '#1a1a1a' },
                            primary: { main: '#90caf9' },
                        }
                        : {
                            // Light Mode Colors
                            background: { default: '#f5f5f5', paper: '#ffffff' },
                            primary: { main: '#1976d2' },
                        }),
                },
            }),
        [mode]
    );

    return (
        <ColorModeContext.Provider value={colorMode}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </ColorModeContext.Provider>
    );
}