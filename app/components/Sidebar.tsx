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
} from '@mui/material';
import AnimationIcon from '@mui/icons-material/Animation';
import HomeIcon from '@mui/icons-material/Home';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const drawerWidth = 240;

const menuItems = [
    { text: 'Home', icon: <HomeIcon />, path: '/' },
    { text: 'Neural Network', icon: <AnimationIcon />, path: '/components/neural-network' },
    { text: 'World Tree', icon: <AnimationIcon />, path: '/components/worldtree' },
    { text: 'Singularity', icon: <AnimationIcon />, path: '/components/singularity' },
    { text: 'Planet Energy Flow', icon: <AnimationIcon />, path: '/components/planet-energy-flow' },
    { text: 'Plant Shop', icon: <AnimationIcon />, path: '/components/plant-shop' },
];

export default function Sidebar() {
    const pathname = usePathname();

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
        </Drawer>
    );
}