# TECHNICAL GAME DESIGN DOCUMENT (T-GDD)

## Project: Nexus - The Awakening

**Version: 2.0 (The Mobility & Synergy Update)**

### 1. Executive Summary

* **Game Title:** Nexus: The Awakening
* **Core Concept:** A fast-paced, Auto-Aim Roguelite Survival game. The player controls a hovering "Energy Core" (Nexus), moving through hordes of enemies to collect resources. Features a definitive 15-wave run structure, infinite synergy skill building, and a persistent "City Rebuilding" meta-progression that encourages speedrunning.
* **Target Platforms:** Web Browser (Mobile via Virtual Joystick / PC via WASD). STRICT RULE: Pure Auto-Aim. No mouse cursor targeting to ensure 1:1 cross-platform consistency.
* **Target Audience:** Progression-junkies, theory-crafters, and speedrunners.

### 2. Core Gameplay & Retention Mechanics

The game shifts from a static tower defense to a highly mobile, high-stakes survival experience inspired by *Vampire Survivors*, enhanced by *The Tipping Point* virality concepts.

**1. Risk & Reward (The Core Loop):**
* *Movement is Mandatory:* The Nexus must move (WASD/Joystick) to dodge enemies.
* *Experience Gems:* Enemies do not give XP automatically. They drop gems. The player must risk diving into enemy swarms to collect them.


**2. The Dopamine Engine (Combat & Juiciness):**
* *Additive Keystones:* Skill tree ultimate nodes (Keystones) DO NOT override each other. They run in parallel (e.g., firing Lasers while surrounded by a Blackhole Aura).
* *1-to-1 Weapon Evolutions:* Collecting specific passive items unlocks "Evolutions" for maxed-out skill branches (e.g., Laser + Graviton Lens = Quasar Beam).
* *Slot Machine Chests:* Elite enemies drop Golden Chests. Collecting them pauses the game and triggers a flashing Roulette UI that grants massive random buffs.


**3. Meta-Progression (Rebuilding Civilization):**
* *Definitive Ending:* The game is not infinitely grinding for nothing. The ultimate goal is to reach 100% "City Rebuilt" on the Main Menu.
* *Pacing:* Each run lasts exactly 15 Waves (~15 minutes). Beating Wave 15 defeats the Boss and yields massive "Reconstruction Materials".
* *Speedrun Bait:* The game tracks the total number of runs and total in-game time taken to reach 100% City Rebuilt, encouraging players to share their speedrun records online.



### 3. Technical Architecture (The Stack)

* **Language:** TypeScript.
* **Rendering Engine:** **PixiJS** (WebGL) heavily utilizing `ParticleContainer` for 10,000+ entities.
* **Game Architecture:** **ECS (Entity-Component-System)** via `bitecs`.
* *Additive Weapon Components:* Every Keystone and Evolution is a separate ECS Component (e.g., `LaserComponent`, `BlackholeComponent`) with its own System. This ensures infinite stacking without logic conflicts.


* **Performance Optimizations:** Object Pooling for Projectiles/Gems and Spatial Hash Grid for collisions.

---

### 4. AI-Assisted Development Roadmap (Phased Execution)

*(This is the step-by-step guide for AI implementation. One phase per session to manage token limits).*

**Phase 1: Foundation (COMPLETED)**
* Core loop, basic ECS setup, rendering, and base Skill Tree data structure implemented.


**Phase 2: Mobility & The Economy Loop (NEXT PRIORITY)**
* **Movement System:** Implement WASD/Arrow key movement with acceleration and friction. Update camera to follow the Nexus.
* **Targeting System:** Implement strict Auto-Aim logic (target nearest/highest HP) for directional weapons like lasers. Fix existing Keystone coordinate bugs.
* **Gem Economy:** Implement `ExperienceGem` drops on enemy death and `GemCollectionSystem` via player collision.


**Phase 3: The Casino & The Swarm**
* **Elites & Chests:** Spawn Elite enemies that drop Golden Chests.
* **Roulette UI:** Implement the game-pause Slot Machine UI when a chest is collected to grant random passive catalysts (e.g., *Hyper-Coolant*, *Uranium Core*).


**Phase 4: Infinite Synergy & Weapon Evolutions**
* **Additive Systems:** Refactor Weapon Systems so Keystones run completely parallel in ECS.
* **Evolution System:** Create the logic that checks if a maxed Skill Branch + a specific Passive Catalyst are owned to spawn an "Evolution Weapon Component" (1-to-1 lock and key).


**Phase 5: Rebuilding Civilization (Meta-Progression)**
* **The 15-Wave Cap:** Restructure the wave spawner to end at Wave 15 with a Boss fight.
* **Main Menu Base Building:** Create the UI and logic for spending collected "Ancient Steel" to upgrade City Buildings (granting permanent global buffs and advancing the % completion bar).
* **The Speedrun Tracker:** Track total playtime/runs to win and generate the final "Victory Certificate" for social sharing.


**Phase 6: Polish & Contextual Content**
* Real-world time mutators (weekend events, night-mode enemies).
* Maximum Juiciness: Camera shake, hit-stop, and floating damage numbers.

### 5. Game State Management & UI Flow
To prevent logic conflicts and ensure smooth UI interruptions (e.g., level-ups, skill upgrades), the ECS and Main Loop must adhere to a strict State Machine:
* **MAIN_MENU:** Renders the "City Rebuilding" UI. ECS is paused.
* **PLAYING:** Active game loop. Physics, Spawners, and Weapons are ticking.
* **LEVEL_UP_PAUSE:** Triggered when XP bar is full. ECS is completely paused. Displays the 3-card RNG drafting UI (Peripheral Weapons & Catalysts).
* **WAVE_TRANSITION_PAUSE:** Triggered when a Wave is cleared. ECS is completely paused. Awards 2 SP and displays the Skill Tree UI for primary branch upgrades.
* **ROULETTE_PAUSE:** Triggered upon touching a Golden Chest. ECS is paused. Displays the Slot Machine UI.
* **GAME_OVER / VICTORY:** Halts the ECS. Calculates materials gathered and transitions back to MAIN_MENU.

### 6. Core Stats Dictionary (scan the code and please finalize here - if the code is already consistency and the assumption of document is wrong, please update document instead and keep the code, otherwise respect the document in all other case)
To ensure consistency across all ECS Components, Systems, and Skill Nodes, strictly use the following exact stat terminologies:
* **Offensive:** `baseDamage`, `damageMultiplier`, `fireRate` (shots per second), `projectileSpeed`, `range` (bullet lifespan/distance), `multishot` (extra projectiles), `aoeRadius` (explosion/aura size).
* **Defensive:** `maxHp`, `currentHp`, `armor` (flat damage reduction), `hpRegen` (HP per second).
* **Utility:** `moveSpeed` (Nexus velocity), `pickupRadius` (magnet size for gems), `luck` (chest drop rate / roulette rarity).

### 7. Placeholder Asset Pipeline
For Phase 1 & 2 development, **DO NOT** attempt to load external textures (e.g., `.png` or `.jpg` files) as they do not exist yet. 
* Strictly use `PIXI.Graphics` to draw procedural geometric shapes for all Entities. 
* *Example:* Nexus = Blue Circle.
* This ensures zero resource-loading errors during rapid ECS prototyping.
  
### APPENDIX A: The Synergy Matrix (Data Structures) - we will only implement 6 branch in skill tree and 2 item in each other list in our MVP

*This appendix outlines the 24 core elements (4 lists of 6 items) that will populate the ECS logic and drive the infinite synergy/evolution mechanics.*

#### List 1: Nexus Chassis (Playable Frames / Base Stats)

The physical core the player controls. Dictates base stats and a unique passive trait.

1. **Aegis Frame (The Fortress):** Slow movement, massive hitbox. *Trait:* Starts with +50% Armor. Gains +2% Max HP permanently after clearing each wave. High base HP regeneration.
2. **Quantum Singularity (The Glass Cannon):** Extremely fast, tiny hitbox. *Trait:* Max HP is permanently locked at 1 (Any hit causes Game Over). All global damage and speed multipliers are doubled (x2).
3. **Chrono Engine (The Time-Weaver):** Nimble and evasive. *Trait:* Every 10 seconds, generates a "Phase Shield" that completely negates the next instance of damage.
4. **Bio-Reactor (The Hybrid):** Low base damage. *Trait:* Vampiric nature. Killed enemies have a 5% chance to drop "Bio-Cells" that instantly heal the Nexus for 5% Max HP when collected.
5. **Prism Generator (The Scatter-Core):** *Trait:* Starts the run with a permanent +2 to the `Multishot` stat for all projectile weapons, but suffers a flat -20% penalty to Base Damage.
6. **Scrap Magnet (The Capitalist):** *Trait:* Starts with a massive +150% boost to `PickupRadius`. Can collect Experience Gems and Core Fragments from halfway across the screen.

#### List 2: Core Branches (Primary Fire Evolutions)

Upgraded via the Skill Tree using SP. These define the primary auto-attack logic. Each branch highlights its Notable node (Key 1) and Keystone node (Key 2).

1. **Rapid Fire (Orange):**
* *Notable 1:* **Incendiary Rounds** (Projectiles have a chance to ignite enemies for burn damage over time - replacing the overly complex acceleration logic).
* *Keystone 2:* **Plasma Beam** (Replaces bullets with a continuous beam. *Logic Update needed:* Change from a static clockwise sweep to a dynamic **Auto-Aim** sweep targeting the nearest/highest HP enemy so it doesn't miss 25% of the swarm. Needs visual polish).


2. **Heavy Strike (Red):** 
* *Notable 1:* **Kinetic Knockback** (Projectiles forcefully push enemies backward - Currently functioning well).
* *Keystone 2:* **Tectonic Explosion** (Projectiles embed and explode. *Implementation needed:* The logic is there, but strictly requires massive **VFX polish** and particle effects to make the explosion feel impactful).


1. **Bulwark (Blue):**
* *Notable 1:* **Thorns Aura** (A baseline damage aura surrounding the Nexus. Logic implemented, strictly needs **VFX rendering**).
* *Keystone 2:* **Radiant Supernova** (A massive aura where damage scales directly with Nexus Max HP. Logic implemented, strictly needs explosive **VFX & visual representation**).


4. **Warp (Cyan/Green):**
* *Notable 1:* **Boomerang Trajectory** (Projectiles return to the Nexus. Currently functioning, slightly overpowered but highly satisfying).
* *Keystone 2:* **Event Horizon** (Transforms projectiles into Black holes. *CRITICAL BUG FIX needed:* Currently spawning on top of the Nexus. Must be fixed to spawn strictly at the projectile's **Maximum Range / Apex** before returning).


5. **Chain (Purple):**
* *Notable 1:* **Seeker Swarm / Auto-Aim** (Projectiles curve to hunt enemies - Currently functioning perfectly, very accessible).
* *Keystone 2:* **Tesla Network** (Replaces projectiles with chain lightning. *Implementation needed:* The chaining logic across multiple enemies needs to be coded from scratch).


6. **Collector (Gold):**
* *Notable 1:* **Archive Network** (Grants +1 Skill Point upon clearing a wave - Functioning well).
* *Keystone 2:* **Capitalist Core / Orbital Drones** (*Logic Update needed:* Stop spawning drones based on "skill upgrades". Instead, spawn 1 permanent Orbital Drone every time the player collects exactly **500 Score/XP from dropped gems**).


#### List 3: Peripheral Weapons (Sub-Weapons)

Acquired randomly from Elite Chests (Roulette) or leveling up. They function as independent ECS systems parallel to the Primary Fire.

1. **Orbital Buzzsaw:** Summons energy blades that constantly rotate around the Nexus, dealing melee damage and pushing enemies back.
2. **Seeker Missile Pod:** Every 3 seconds, launches missiles into the air that auto-target and crash into the Elite/Boss enemies on the map.
3. **Seismic Thumper:** Triggers a ground-slam shockwave that slows down all nearby enemies. *Trigger Condition:* Activates based on the distance the Nexus has moved (encourages moving around).
4. **Cryo-Mines:** Automatically drops freezing mines behind the Nexus as it moves. Enemies stepping on them are frozen solid for 2 seconds.
5. **Plasma Arc:** A frontal cone sweep (like a windshield wiper) that clears out weak enemies directly in the Nexus's movement path.
6. **Photon Swarm:** Releases a cloud of micro-nanobots that wander near the Nexus, automatically latching onto the lowest-HP enemies to execute them.

#### List 4: Passive Catalysts (Evolution Keys)

Acquired from the Roulette Chests. They provide massive stat boosts and act as the "Key" to evolve maxed-out Core Branches or Sub-weapons.

1. **Hyper-Coolant:** Provides massive Cooldown Reduction (CDR) for all weapons.
2. **Graviton Lens:** Increases the Area of Effect (AoE), aura radius, and projectile size.
3. **Overclock Chip:** Greatly increases Projectile Speed and Nexus Movement Speed.
4. **Uranium Core:** Provides a massive multiplier to Base Damage and Critical Hit Chance.
5. **Exo-Casing:** Grants flat Armor (damage reduction) and a massive boost to Max HP.
6. **Replicator Matrix:** Adds a global multiplier to the `Multishot` and `SpawnCount` stats.

Note the evolve details is still in brainstorming.

Other notes:
### 1. The RNG Drafting System (Cơ chế Chọn đồ khi Lên cấp)

Chúng ta đã bàn về việc nhặt Ngọc XP, nhưng chưa chốt **chuyện gì xảy ra khi thanh XP đầy?**

**Vấn đề:** Trong VS, lên cấp thì hiện ra 3 món ngẫu nhiên để chọn. Nhưng game của mình lại có cái Skill Tree 49 nodes (dùng SP thưởng mỗi wave). Vậy 2 cái này hoạt động song song thế nào để người chơi không bị lú?
**Giải pháp chốt hạ:**
* **Primary Fire (Nhánh Skill Tree):** Chỉ được nâng cấp sau khi **Clear Wave** (nhận 2 SP). Giao diện Skill Tree hiện ra để bro cộng điểm. Cái này là *Sự chắc chắn (Deterministic)*.
* **Sub-Weapons & Passives (Danh sách 3 & 4):** Nhận được khi **Lên Cấp (Nhặt đủ Ngọc XP)**. Khi thanh XP đầy, game Pause, hiện ra 3 thẻ bài ngẫu nhiên (RNG) để bro chọn (Ví dụ: Nhặt Lưỡi cưa, hay nhặt Lõi tản nhiệt?). Cái này tạo ra *Sự may rủi (Roguelite)*.


* **=> Thiếu sót:** Chúng ta chưa có lệnh cho AI code cái UI chọn 3 thẻ bài (Drafting Screen) và `LevelUpSystem`.

### 2. The AI Director (Hệ thống "Đạo diễn" Sinh quái)

Bro đang than phiền quái lọt qua Laze, hoặc bắn 3 wave là chết. Đó là do cái Spawner của mình đang quá "ngu", chỉ biết nhét quái vào màn hình một cách vô tội vạ.

* **Giải pháp:** Cần một `WaveManagerSystem` hoạt động như một "Đạo diễn".
* *Đầu wave:* Spawn quái yếu, chạy chậm để bro nhặt ngọc khởi động.
* *Giữa wave:* Spawn một bầy quái siêu đông (Swarm) chạy ùa vào cùng lúc từ 1 hướng để test DPS của bro (ép bro phải dùng AoE hoặc Laze để khoét lỗ thoát thân).
* *Cuối wave:* Spawn Elite (Quái cầm khiên/Thanh trừng) ép bro phải di chuyển vòng vạch.


* **=> Thiếu sót:** Cần định nghĩa cấu trúc JSON cho 15 Waves (Wave 1 ra con gì, Wave 5 ra con gì).

### 3. Trùm Cuối (The Wave 15 Apex Boss)

Đã gọi là "Phá đảo" ở Wave 15 thì không thể chỉ là một con quái to hơn bình thường bước ra cho bro bắn được. Nó phải là một màn **Bullet Hell (Đạn mạc)**.

* **Concept Boss: "The Entropy" (Thực thể Hỗn Mang)**
* *Phase 1:* Nó đứng giữa màn hình, nhả ra các lưới đạn hình học ép con Lõi Nexus của bro phải lách qua những khe hẹp tí hon.
* *Phase 2:* Nó tắt đèn toàn map, chỉ còn ánh sáng leo lét quanh Nexus, và nó sẽ lao tới vồ bro (Dash attack).


* **=> Thiếu sót:** Hoàn toàn chưa có `BossSystem` và cơ chế vạch máu Boss (Boss HP Bar) to đùng trên góc màn hình.

### 4. Hệ thống Âm Thanh (The Unsung Hero)

Bro có nhớ cái "Juiciness" không? Rung màn hình, sát thương nhảy loạn xạ là Hình ảnh. Nhưng 50% Dopamine của Vampire Survivors đến từ **Âm thanh nhặt ngọc (Ting ting ting) và Âm thanh mở rương**.

* Nếu game WebGL 10.000 quái mà mỗi con chết phát ra 1 file âm thanh thì trình duyệt sẽ sập (Audio Context Limit).
* **=> Thiếu sót:** Cần yêu cầu AI code một `AudioManager` có tính năng **Audio Pooling và Pitch Shifting** (Gộp âm thanh lại và đổi cao độ liên tục để nghe "đã tai" mà không bị lag). Nhặt 1 viên ngọc kêu *tinh*, nhặt 100 viên ngọc cùng lúc nó phải kêu cái *XÈO* như tiếng xóc đồng xu.

---

### 5. UI/HUD Tổng thể (Giao diện trong trận)

* Bro đang điều khiển con Nexus di chuyển, vậy nhìn máu ở đâu? Nhìn thời gian đếm ngược của Wave ở đâu?
* **=> Thiếu sót:** Cần thiết kế một lớp UI (Canvas hoặc HTML Overlay) hiển thị:
* Thanh máu (HP Bar) nằm ngay trên đầu cục Nexus (hoặc viền màn hình đỏ lên khi yếu máu).
* Thanh XP màu xanh dương nằm ngang mép trên cùng màn hình.
* Đồng hồ đếm ngược Wave (Ví dụ: `Wave 4 - 00:45`) nằm ở giữa góc trên.
* Danh sách các Icon Vũ khí/Nội tại bro đã nhặt được nằm dọc bên góc trái màn hình.