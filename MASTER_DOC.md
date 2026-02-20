# TECHNICAL GAME DESIGN DOCUMENT (T-GDD)

## Project: Nexus - The Awakening

### 1. Executive Summary

* **Game Title:** Nexus: The Awakening
* **Core Concept:** A hybrid Roguelite Survival, Auto-Battler, and Base-Building game. The player acts as a central "Energy Core" (Nexus), surviving relentless waves of enemies by unlocking a massive, interconnected skill tree.
* **Target Platforms:** Web Browser (Mobile/PC) and Native PC (via Tauri wrapper).
* **Target Audience:** Min-maxers, progression-junkies, and casual players seeking high dopamine hits through visual scaling.

### 2. Core Gameplay & "The Tipping Point" Mechanics

The game's virality and retention are engineered around Malcolm Gladwell's *The Tipping Point*:

* **The Law of the Few (Virality Engine):**
* *Mavens (The Analysts):* A massive, complex **Skill Tree** (similar to Path of Exile). Players can deeply customize elemental fusions, projectile behaviors, and passive stats.
* *Connectors (The Sharers):* **Build Code Export/Import**. Players can convert their massive skill tree layout into a short string (e.g., `NEXUS-FIRE-XYZ123`) to share on Discord/Reddit.
* *Salesmen (The Streamers):* **Twitch/TikTok API Integration**. Viewers can type commands to spawn special enemies or drop buffs for the streamer.


* **The Stickiness Factor (Retention Engine):**
* *Snowball Effect:* Starts exceptionally slow and vulnerable. Rapidly transitions into screen-clearing, explosive chaos within 10 minutes, providing massive dopamine spikes.
* *Idle Progression:* The Nexus gathers passive resources while offline. Returning players are immediately rewarded with upgrade materials.


* **The Power of Context (Environmental Immersion):**
* *Dynamic Real-Time Events:* The game reads the user's local time and date. Playing at night spawns "Shadow" enemies; playing on weekends increases drop rates. Theme alters dynamically based on the real-world context.



### 3. Technical Architecture (The Stack)

To handle the extreme rendering requirements (5,000 to 100,000 concurrent entities) while maintaining a clean, AI-friendly codebase, the project strictly adheres to the following stack:

* **Language:** TypeScript (Strict typing ensures AI coding assistants maintain perfect context across large codebases).
* **Rendering Engine:** **PixiJS** (WebGL/WebGPU focused). Strictly used for drawing, relying heavily on `ParticleContainer` for mass-entity rendering.
* **Game Architecture:** **ECS (Entity-Component-System)**.
* *Why ECS?* Decouples data (Components) from logic (Systems). Allows CPU to iterate over flat arrays at lightning speed. Highly readable for AI logic generation.
* *Library:* `bitecs` (or a custom lightweight ECS implementation).


* **Performance Optimizations:**
* *Object Pooling:* Pre-allocate arrays for enemies/projectiles to prevent Garbage Collection (GC) stuttering.
* *Spatial Hash Grid:* Efficient collision detection system to avoid O(N^2) calculations when thousands of entities overlap.


* **Build & Bundling:** Vite (for instant HMR on the web).
* **PC Desktop Wrapper:** Tauri (Rust-based, incredibly lightweight compared to Electron) to compile the web build into a native `.exe`.

### 4. AI-Assisted Development Roadmap (10k+ LOC / Phase)

* **Phase 1: Foundation (Core Loop & ECS Setup)**
* Initialize Vite + TypeScript + PixiJS + ECS.
* Implement the main game loop, basic spawner, movement logic, and a game-over state.


* **Phase 2: The Maven Trap (Massive Skill Tree)**
* Define JSON/Data structures for nodes.
* Implement the UI for rendering the tree (pan, zoom, node connections).
* Dynamic stat-recalculation based on active nodes.


* **Phase 3: The Virality Layer (Social & Output)**
* Implement the Build Code stringifier/parser (Base64 encoding state).
* Integrate basic WebSockets or API calls for the Streamer interaction feature.


* **Phase 4: Contextual Content (Scaling & Real-time)**
* Implement the `DateTime` logic for Dynamic Events.
* Generate massive content variations (50+ enemy types, varied sprite tints, attack patterns).


* **Phase 5: Polish & Deployment**
* Audio integration, particle juiciness, UI polishing.
* Wrap with Tauri for PC distribution and deploy web version via Vercel/Netlify.
