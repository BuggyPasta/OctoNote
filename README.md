# OctoNote

A minimalist, self-hosted note-taking app optimized for Debian 12.

## ⚠️ Important Security Notes

- Display names are not authenticated. This is for identification only, not security. Any user on the LAN can select any name unless it's already in use.
- Note locking is in-memory only. If the container restarts, all locks will be reset.
- Manual backups of `/home/alex/docker_backup/octonote` are required to prevent data loss.

## Features

- Simple, no-frills note-taking
- Dark mode interface
- Mobile-responsive design
- Local LAN access only
- No authentication required
- Plain text storage
- Real-time note locking

## Requirements

- Debian 12 (Bookworm)
- Docker
- Port 51828 available

## Quick Start

1. Clone this repository
2. Build the Docker image:
   ```bash
   docker build -t octonote .
   ```
3. Deploy using Dockge:
   - Create a new stack
   - Name it "OctoNote"
   - Paste the contents of the `docker-compose.yml` file
   - Deploy the stack

## Data Storage

All data is stored in `/data/octonote` inside the container, which is bind-mounted to `/home/alex/docker_backup/octonote` on the host:

- `notes/`: Individual note files
- `users.txt`: List of display names
- `logs/`: Application logs

## Backup

Regular backups of the `/home/alex/docker_backup/octonote` directory are essential. This is the only backup mechanism provided.

## License

MIT 