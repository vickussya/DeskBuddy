# DeskBuddy 🐱

A personal desktop organiser for Windows, built around a small always-on-top character icon that opens into **Studio** — a full workspace for tasks (and, soon, a diary, goals, and an inspiration board).

![DeskBuddy preview](src/assets/characters/cat.svg)

<img width="636" height="258" alt="Screenshot 2026-05-27 143158" src="https://github.com/user-attachments/assets/b42e256c-9521-4b89-968f-c240099fee87" />


## Features

- **Floating character icon** — frameless, always on top, draggable, remembers its position; stays on screen until you close it yourself, and is the quick way to reopen Studio
- **Studio** — a resizable main window with a sidebar: Home, Tasks, Diary, Goals, Inspo (the latter three are placeholders for now — see Roadmap), and Settings
- **Multi-workspace Tasks** — split your tasks into named workspaces (Uni / Personal / Work by default; add, rename, or delete your own)
- **Two-way task sync per workspace** — edit tasks in Studio or directly in each workspace's `.txt` file in Notepad; both stay in sync live via file watching
- **System tray** — lives in the tray when closed, right-click to reopen Studio, bring back the icon, or quit
- **Characters** — Cat, Dog, Person, Robot built-in, or upload a custom image
- **Character scheduler** — assign a specific character to a date range
- **Warm hand-drawn aesthetic** — built on a CSS-variable theme so more visual styles can be added later

## Roadmap

Diary, Goals, and Inspo (a freeform PureRef-style board for images/video/sketches, usable both standalone and attached to individual tasks) are planned next, followed by in-app folders with shortcuts to local files/folders, and a theme picker (starting with a retro Windows-98-style skin alongside the current cozy look).

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- Windows 10/11

### Install & Run

```bash
git clone https://github.com/vickussya/DeskBuddy.git
cd DeskBuddy
npm install
npm start
```

Or double-click `start-deskbuddy.bat`.

### First Run

On first launch DeskBuddy creates one `.txt` file per task workspace in:
```
%APPDATA%\deskbuddy\tasks\<workspace-id>.txt
```
e.g. `tasks\uni.txt`, `tasks\personal.txt`, `tasks\work.txt`. Open any of them in Notepad to add tasks — one per line. Changes reload automatically in Studio. If you're upgrading from an older version with a single `tasks.txt`, its contents are imported into the Personal workspace once, and the original file is left untouched.

## Replacing Placeholder Assets

| Asset | Location | Format |
|---|---|---|
| Character images | `src/assets/characters/` | `cat.png`, `dog.png`, `person.png`, `robot.png` |
| Tray icon | `src/assets/tray-icon.png` | 16×16 PNG |

## Tech Stack

- [Electron](https://www.electronjs.org/) v28
- Vanilla HTML / CSS / JavaScript (no frontend framework)
- [chokidar](https://github.com/paulmillr/chokidar) for file watching
- Plain JSON + text files for persistence (no database)

## Project Structure

```
DeskBuddy/
├── main.js                   # Electron main process
├── preload.js                # Context bridge (IPC)
├── launch.js                 # Launcher (strips ELECTRON_RUN_AS_NODE)
├── src/
│   ├── renderer/
│   │   ├── icon.html/js/css  # Always-on-top character launcher window
│   │   ├── studio.html       # Studio shell (sidebar + panels)
│   │   ├── studio.css
│   │   ├── studio.js         # Bootstrap
│   │   ├── studio-nav.js     # Sidebar section switching
│   │   ├── studio-tasks.js   # Multi-workspace Tasks
│   │   ├── studio-settings.js# General / Character / Schedule
│   │   └── theme.css         # CSS-variable palette (swappable via [data-theme])
│   └── assets/
│       ├── characters/       # Character images (SVG placeholders)
│       ├── sounds/           # Unused for now (icon window is silent)
│       └── tray-icon.png
└── start-deskbuddy.bat        # Windows launcher shortcut
```

## License

MIT
