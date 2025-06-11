# OctoNote

A simple, local-first note-taking application that allows multiple users to create and manage notes. Built with Node.js and Express, featuring a clean and intuitive user interface.

## Features

- **User Management**: Create and manage multiple users with unique note collections
- **Active User Display**: Shows the currently active user's name in the header
- **Note Creation**: Create new notes with custom titles and content
- **Note Editing**: Edit existing notes with undo functionality
- **Note Deletion**: Delete notes with confirmation
- **Note Transfer**: Transfer notes between users when deleting a user
- **Responsive Design**: Works on both desktop and mobile devices
- **Dark Mode**: Modern dark theme for comfortable viewing
- **Local Storage**: All data is stored locally with no external dependencies
- **No Internet Required**: Works completely offline
- **Real-time note locking**: Prevents concurrent edits and conflicts
- **Manual note saving**: Save changes with undo support
- **System status monitoring**: Check application health
- **Copy note content**: One-click copy to clipboard
- **Unsaved changes warning**: Alerts when navigating away with unsaved changes
- **Multiple undo levels**: 10 levels of undo history for note editing

## Docker Installation

This application is designed to run in a Docker environment using Dockge.

### Prerequisites
- Docker
- Dockge
- Debian 12 (tested environment, but may work on other Linux distributions)

### Docker Compose Configuration

```yaml
services:
  octonote:
    build:
      context: https://github.com/BuggyPasta/OctoNote.git
      dockerfile: Dockerfile
    container_name: octonote
    restart: unless-stopped
    ports:
      - "51828:51828"
    volumes:
      - /docker/user/docker/backup/octonote:/data/octonote
    environment:
      - NODE_ENV=production
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:51828/api/status"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    networks:
      - octonote_network
    labels:
      com.centurylinklabs.watchtower.enable: "false"

volumes:
  octonote_data:
    name: octonote_data

networks:
  octonote_network:
    name: octonote_network
    driver: bridge
```

### Installation with Dockge

1. In your Dockge interface, create a new stack
2. Copy the Docker Compose configuration above
3. Deploy the stack
4. Access the application at `http://localhost:51828`

## Future Development

No future development is planned for this application. This is indicated by the Watchtower configuration in the docker-compose.yml file (line 25: `com.centurylinklabs.watchtower.enable: "false"`), which disables automatic update checks. If you are not using Watchtower for container updates, you can safely remove this label from your docker-compose.yml file.

## Directory Structure

```
octonote/
├── public/
│   ├── css/
│   │   └── styles.css
│   │   
│   │   └── icons/
│   │   
│   │   └── js/
│   │       └── app.js
│   │   
│   └── index.html
│   
│   └── src/
│       ├── routes/
│       │   ├── notes.js
│       │   ├── status.js
│       │   └── users.js
│       │   
│       └── server.js
│   
│   └── .gitignore
│   
│   └── docker-compose.yml
│   
│   └── Dockerfile
│   
│   └── LICENSE
│   
│   └── package.json
│   
└── README.md
```

## VERY IMPORTANT NOTE. NO, SERIOUSLY.

OctoNote is designed ONLY FOR LOCAL NETWORK USE and does NOT implement ANY security measures for Internet exposure. The application:

- Is intended for use on private networks ONLY
- Does NOT include authentication or encryption for internet access
- Stores potentially sensitive personal data
- Should only be accessed through a secure VPN or Wireguard connection
- Has NO user authentication system - users can freely switch between accounts
- Is best suited for trusted environments like family or close friends

For secure usage:
1. Keep the application within your local network
2. Use a VPN or Wireguard tunnel for remote access
3. Do NOT expose the application directly to the internet
4. Regularly backup your data (see [Backup and Restore](#backup-and-restore))
5. Only share access with people you trust completely

Use of this application is at your own risk.

## Backup and Restore

All persistent data is stored in the volume defined in your docker-compose.yml and that's where the notes and users are saved. To backup your data:

1. The data is stored in `/home/user/docker_backup/octonote` (but you can change this to your liking)
2. Simply backup this directory to preserve all your notes and user data
3. To restore, ensure the backup is placed in the same location before starting the container

## Authors

BuggyPasta, with lots of help from A.I. because BuggyPasta is otherwise WORTHLESS in programming

## Acknowledgments

- Vectors and icons by SVG Repo
- Built with Node.js and Express
