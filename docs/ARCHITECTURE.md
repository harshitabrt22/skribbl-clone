# Doodle Dash — Architecture Documentation

This document describes the architectural design, communication protocols, state management, and secrecy mechanisms of Doodle Dash, a real-time multiplayer drawing and guessing game built with React, Node.js, Express, and Socket.IO.

---

## 1. High-Level System Architecture

```mermaid
flowchart TD
  subgraph Client[Browser Frontend - React + TypeScript]
    UI[React Components / UI Layer]
    GC[GameContext Reducer & Socket Listener]
    DC[DrawingCanvas HTML5 2D Context]
    SS[(sessionStorage: sessionId)]

    UI <--> GC
    UI <--> DC
    GC <--> SS
  end

  subgraph Network[Transport Layer]
    WS[WebSocket / Socket.IO Transport]
    HTTP[HTTP GET /health, /api/rooms/public, static assets]
  end

  subgraph Server[Backend - Node.js + Express + Socket.IO]
    EXP[Express HTTP Server]
    SIO[Socket.IO Server & Rate Limiters]
    RH[registerHandlers Event Router]
    RM[RoomManager]
    R[Room Instances]
    G[Game State Machine]
    P[Player Models]

    EXP --> HTTP
    SIO --> WS
    SIO --> RH
    RH --> RM
    RM --> R
    R --> G
    R --> P
  end

  GC <==> WS <==> SIO
  DC -.->|draw_start, draw_move, draw_end| WS
  WS -.->|draw_data, draw_undo, canvas_clear| DC
  UI <==> HTTP <==> EXP
```

### Architectural Decisions & Rationale
1. **Single-Origin Monolith for Deployment:** The backend serves the built React frontend (`client/dist`) from the same Express instance. This removes all cross-origin CORS negotiation, cookie/session domain conflicts, and synchronization issues between separate frontend and backend deployments on platforms like Render.
2. **In-Memory Server State:** Rooms and game sessions are ephemeral. All room metadata, timers, player states, and strokes live in memory via OOP classes (`RoomManager`, `Room`, `Game`, `Player`), eliminating database overhead and latency.
3. **Session-Based Reconnection:** Player sessions are tracked using cryptographically random `sessionId` tokens stored in browser `sessionStorage`. If a player refreshes their tab or experiences momentary network failure, they automatically rebind to their existing player slot without duplicating lobby entries or resetting scores.

---

## 2. Drawing Pipeline & Canvas Synchronization

Strokes are captured, normalized, broadcast, and rendered using an optimistic local + round-trip remote approach:

```mermaid
sequenceDiagram
  autonumber
  actor Drawer as Drawer (Client A)
  participant CanvasA as HTML5 Canvas (Client A)
  participant Server as Socket.IO Server
  participant CanvasB as HTML5 Canvas (Client B)
  actor Guesser as Guesser (Client B)

  Note over Drawer,CanvasA: 1. Pointer Down
  Drawer->>CanvasA: pointerdown (x, y)
  CanvasA->>CanvasA: Optimistic local render (drawDot)
  CanvasA->>Server: emit draw_start { x, y, color, size, tool }
  
  Note over Server: Authorize: phase==DRAWING & socket==drawerId
  Server->>Server: Store stroke in Game.strokes
  Server-->>CanvasB: broadcast to others: draw_data (start)
  CanvasB->>CanvasB: Remote render initial dot

  Note over Drawer,CanvasA: 2. Pointer Move (Streaming)
  Drawer->>CanvasA: pointermove (delta > 0.002)
  CanvasA->>CanvasA: Optimistic local render (drawSegment)
  CanvasA->>Server: emit draw_move { x, y } (Rate-limited <=120/s)
  Server->>Server: Append point to currentStroke
  Server-->>CanvasB: broadcast to others: draw_data (move)
  CanvasB->>CanvasB: Remote render segment with round line caps

  Note over Drawer,CanvasA: 3. Pointer Up
  Drawer->>CanvasA: pointerup
  CanvasA->>Server: emit draw_end {}
  Server-->>CanvasB: broadcast to others: draw_data (end)
```

### Critical Drawing Guarantees
* **Coordinate Normalization:** Coordinates are transmitted as normalized floats in the interval `[0, 1]`, mapped to a logical 800×600 canvas coordinate system. Clients scale smoothly to any screen aspect ratio without stroke distortion.
* **Non-Echoing Optimization:** `draw_data` is emitted to room members *excluding* the drawer (`socket.to(room.code)`). This completely prevents double-rendering, flickering, and synthetic lag on the drawing client.
* **Canvas Stroke Preservation:** On React re-renders, socket listeners maintain stable references (`useRef`), ensuring canvas contexts and active strokes are never cleared prematurely on state updates.

---

## 3. Game State Lifecycle & Phase Transitions

The game transitions through well-defined phases managed by the authoritative server `Game` class:

```mermaid
stateDiagram-v2
  [*] --> LOBBY
  LOBBY --> STARTING: Host clicks Start Game (>= 2 players ready)
  STARTING --> WORD_SELECTION: Turn initialized (Round N, Turn K)
  
  WORD_SELECTION --> DRAWING: Drawer selects word OR 15s timeout auto-picks
  
  DRAWING --> ROUND_END: Timer hits 0 OR all guessers correct OR drawer leaves
  
  ROUND_END --> WORD_SELECTION: More turns remain in round/game
  ROUND_END --> GAME_OVER: All turns for all rounds completed
  
  GAME_OVER --> LOBBY: Host clicks Play Again (scores/streaks reset)
```

---

## 4. Guess Matching, Secrecy & Progressive Hints

```mermaid
flowchart TD
  GuessInput[Guesser sends 'guess' or 'chat'] --> PhaseCheck{Phase == DRAWING?}
  PhaseCheck -- No --> BroadcastChat[Broadcast as public chat_message]
  PhaseCheck -- Yes --> DrawerCheck{Is Sender Drawer?}
  DrawerCheck -- Yes --> BlockDrawer[Block if contains word; else chat]
  DrawerCheck -- No --> CorrectCheck{Already Guessed Correctly?}
  CorrectCheck -- Yes --> BlockGuess[Display to drawer/correct guessers only]
  CorrectCheck -- No --> MatchCheck{normalizeGuess(text) == normalizeGuess(word)?}
  
  MatchCheck -- Correct --> AwardScore[Award points + streak bonus + drawer points]
  AwardScore --> AnnounceCorrect[Broadcast 'Player guessed the word!' without word]
  AwardScore --> CheckAllGuessed{All connected guessers done?}
  CheckAllGuessed -- Yes --> EndTurnEarly[End turn early -> ROUND_END]
  CheckAllGuessed -- No --> KeepDrawing[Continue drawing countdown]

  MatchCheck -- Incorrect --> CloseCheck{Levenshtein distance <= 1 AND length >= 5?}
  CloseCheck -- Yes --> CloseHint[Private emit to guesser: 'So close!' not in chat]
  CloseCheck -- No --> BroadcastPublicChat[Broadcast as standard chat message]
```

### Word Secrecy Architecture
To prevent clients from inspecting WebSocket packets in DevTools to cheat:
1. **Targeted Emits (`io.to(drawerSocket)`):** The raw word and word selection options are dispatched exclusively to the drawer's socket ID.
2. **Dynamic Masking (`hints.ts`):** Guessers receive only masked representations (`_ _ _ _ _`) computed server-side.
3. **Scheduled Letter Reveals (Feature B):** At `drawTime * k / (h + 1)` intervals, the server reveals individual random character indices. The client only ever receives the resulting updated mask string (`hint_update { mask }`).
4. **Reveal on Round End Only:** The unmasked word is broadcast room-wide only in the `round_end` event after all scoring has closed.

---

## 5. Scoring & Streak Engine

* **Base Guesser Score:** `100 + floor(200 * remainingTime / totalTime)` (100 to 300 points based on speed).
* **Drawer Bonus:** `+50` points per correct guesser.
* **Streak Progression (Feature C):**
  * Turn 1: `+0` bonus
  * Turn 2: `+20` bonus
  * Turn 3: `+40` bonus
  * Turn 4: `+60` bonus
  * Turn 5+: `+80` bonus (maximum cap)
* **Challenge Card Reward (Feature A):** `+25` bonus points awarded to the drawer at round end if an enforced challenge was accepted and at least one guesser identified the word.
