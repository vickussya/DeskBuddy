# DeskBuddy 🐱

A friendly always-on-top desktop companion for Windows that shows your daily tasks as a checklist inside a hand-drawn speech bubble next to a character of your choice.

![DeskBuddy preview](src/assets/characters/cat.svg)

## Features

- **Floating window** — frameless, always on top, draggable, remembers its position
- **System tray** — lives in the tray when closed, right-click to reopen or quit
- **Daily task checklist** — tasks shown inside a speech bubble, paginated (5 per page), auto-reset every midnight
- **Two-way task sync** — edit tasks in the app or directly in `tasks.txt` in Notepad; both stay in sync live via file watching
- **Characters** — Cat, Dog, Person, Robot built-in; each plays a greeting sound on open
- **Custom character** — upload any image to use as your companion
- **Character scheduler** — assign a specific character to a date range
- **Settings panel** — mute toggle, auto-start on Windows login, open tasks file in Notepad, character picker
- **Warm hand-drawn aesthetic** — sketchy speech bubble, soft color palette

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

On first launch DeskBuddy creates a `tasks.txt` file in:
```
%APPDATA%\deskbuddy\tasks.txt
```
Open it in Notepad to add tasks — one per line. Changes reload automatically.

## Replacing Placeholder Assets

| Asset | Location | Format |
|---|---|---|
| Character images | `src/assets/characters/` | `cat.png`, `dog.png`, `person.png`, `robot.png` |
| Sounds | `src/assets/sounds/` | `meow.wav`, `woof.wav`, `hi-there.wav`, `beep-boop.wav` |
| Tray icon | `src/assets/tray-icon.png` | 16×16 PNG |

## Tech Stack

- [Electron](https://www.electronjs.org/) v28
- Vanilla HTML / CSS / JavaScript (no frontend framework)
- [chokidar](https://github.com/paulmillr/chokidar) for file watching
- Plain JSON file for persistence (no database)

## Project Structure

```
DeskBuddy/
├── main.js               # Electron main process
├── preload.js            # Context bridge (IPC)
├── launch.js             # Launcher (strips ELECTRON_RUN_AS_NODE)
├── src/
│   ├── renderer/
│   │   ├── index.html    # Main companion window
│   │   ├── style.css
│   │   ├── renderer.js
│   │   ├── settings.html # Settings panel
│   │   ├── settings.css
│   │   └── settings.js
│   └── assets/
│       ├── characters/   # Character images (SVG placeholders)
│       ├── sounds/       # Greeting sounds (WAV)
│       └── tray-icon.png
└── start-deskbuddy.bat   # Windows launcher shortcut
```

## License

MIT
