'use client'; // Required for MUI components in Next.js App Router

import { Button, Stack, Typography } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <Stack spacing={2} direction="column" alignItems="center">

        <Typography variant="h4" component="h1">
          Hello Material UI!
        </Typography>

        <Button variant="contained" endIcon={<SendIcon />}>
          Send Message
        </Button>

        <Button variant="outlined" color="error">
          Cancel
        </Button>

      </Stack>
    </div>
  );
}