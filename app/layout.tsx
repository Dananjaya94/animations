import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

// ✅ Import the new Provider
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import Box from '@mui/material/Box';
import ThemeContextProvider from './ThemeContext';
import Sidebar from './components/Sidebar';

// Font imports
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Animation Library',
  description: 'A collection of React animations',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AppRouterCacheProvider>

          {/* ✅ CRITICAL: Everything must be wrapped in ThemeContextProvider */}
          <ThemeContextProvider>

            <Box sx={{ display: 'flex' }}>
              <Sidebar />
              <Box
                component="main"
                sx={{
                  flexGrow: 1,
                  // This ensures the background changes color
                  bgcolor: 'background.default',
                  // This ensures text changes color
                  color: 'text.primary',
                  p: 3,
                  minHeight: '100vh',
                }}
              >
                {children}
              </Box>
            </Box>

          </ThemeContextProvider>

        </AppRouterCacheProvider>
      </body>
    </html>
  );
}