'use client';

import {
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Toolbar,
    Divider,
    Box,
    Switch,
    FormControlLabel
} from '@mui/material';
import AnimationIcon from '@mui/icons-material/Animation';
import HomeIcon from '@mui/icons-material/Home';
import Brightness4Icon from '@mui/icons-material/Brightness4'; // Dark Mode Icon
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useColorMode } from '../ThemeContext'; // Import your hook
import { text } from 'stream/consumers';

const drawerWidth = 240;

const menuItems = [
    { text: 'Home', icon: <HomeIcon />, path: '/' },
    { text: 'Neural Network', icon: <AnimationIcon />, path: '/components/neural-network' },
    { text: 'World Tree', icon: <AnimationIcon />, path: '/components/worldtree' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { mode, toggleColorMode } = useColorMode(); // Hook to control theme

    return (
        <Drawer
            variant="permanent"
            sx={{
                width: drawerWidth,
                flexShrink: 0,
                [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
            }}
        >
            <Toolbar>
                <Box sx={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'primary.main' }}>
                    My Animations
                </Box>
            </Toolbar>
            <Divider />

            <Box sx={{ overflow: 'auto', flexGrow: 1 }}>
                <List>
                    {menuItems.map((item) => (
                        <ListItem key={item.text} disablePadding>
                            <ListItemButton
                                component={Link}
                                href={item.path}
                                selected={pathname === item.path}
                            >
                                <ListItemIcon>
                                    {item.icon}
                                </ListItemIcon>
                                <ListItemText primary={item.text} />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
            </Box>

            <Divider />

            {/* ✅ Theme Toggle Switch */}
            <Box sx={{ p: 2 }}>
                <FormControlLabel
                    control={
                        <Switch
                            checked={mode === 'dark'}
                            onChange={toggleColorMode}
                            color="primary"
                        />
                    }
                    label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Brightness4Icon fontSize="small" />
                            {mode === 'dark' ? 'Dark Mode' : 'Light Mode'}
                        </Box>
                    }
                />
            </Box>
        </Drawer>
    );
}