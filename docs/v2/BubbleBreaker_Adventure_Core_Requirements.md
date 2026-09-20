# BubbleBreaker — Adventure Core Requirements

## Codex handoff / new project specification

**Document purpose**: This document replaces the previous UI-first BubbleBreaker v2 direction. It defines the product from the user experience backward.

**Suggested Codex project name**: `BubbleBreaker-AdventureCore`

**Primary implementation rule**: Do not begin by turning the existing category tree into a fantasy map. First implement the adventure experience described here, then connect the existing information structure to it.

---

## 0. What changed from the previous direction

The previous direction was still too close to:

> information site + fantasy skin + category navigation

That is not the target.

The new direction is:

> **An information adventure in which the user follows curiosity, clues, discoveries, and unexpected connections, and only afterward realizes that they have moved outside their usual information bubble.**

The fantasy world is not decoration and categories are not simply renamed to “villages” or “cities”.

The user should **not feel that they are clicking category B after category A**.

They should feel that they:

1. noticed something interesting,
2. approached it,
3. uncovered a mystery or fact,
4. understood an unexpected connection,
5. saw the world open up,
6. noticed another unexplained thing,
7. continued because they wanted to know what was there.

---

# 1. Product premise

## 1.1 Problem

Modern internet systems often optimize information delivery around a user's previous behavior, interests, and predicted preferences. This can narrow exposure and make the user spend more time inside a familiar information bubble.

BubbleBreaker aims to create an intentional counter-experience:

> **Use curiosity to move the user away from the familiar and toward meaningful, surprising discoveries.**

## 1.2 Product promise

> **You came here looking for one thing. You leave having discovered a world you did not know existed.**

## 1.3 Product identity

BubbleBreaker is:

- an information exploration experience,
- a serendipity engine,
- a curiosity-driven interface,
- a visual adventure world,
- a mechanism for breaking habitual information paths.

BubbleBreaker is not primarily:

- a search engine,
- a news feed,
- a recommendation feed,
- a category browser,
- a conventional game,
- an XP/level/ranking system.

---

# 2. The highest-priority UX requirement

## PRIME DIRECTIVE

> **At every meaningful interaction, there should be a reason for the user to wonder: “What is over there?” “Why is this here?” or “Where does this lead?”**

This requirement outranks visual polish, gamification, and information density.

If an implementation is beautiful but the user simply reads cards and follows obvious categories, it has failed the core requirement.

---

# 3. Core emotional loop

The intended emotional loop is:

```text
FORECAST
  ↓
"Something is there..."
  ↓
CURIOSITY
  ↓
"What is that?"
  ↓
APPROACH
  ↓
DISCOVERY
  ↓
"Wait — why is this connected?"
  ↓
CONNECTION
  ↓
"Oh, I get it."
  ↓
REVEAL
  ↓
"Then what is over there?"
  ↓
NEXT CURIOSITY
```

This loop should repeat throughout the session.

---

# 4. Definition of “adventure” in BubbleBreaker

Adventure does **not** mean adding combat, quests, inventory, or character stats.

Adventure means:

> **The user does not know exactly what they will encounter, but they can always detect signs that something worth discovering exists nearby.**

The user has agency, but the system also creates controlled uncertainty.

### Important balance

Too much control:

> user chooses a topic → user sees only expected topics

This recreates the bubble.

Too much randomness:

> random topic → random topic → random topic

This creates noise rather than discovery.

Target:

> **intentional surprise**

The destination is not obvious, but the connection can be understood after discovery.

---

# 5. Fantasy-world principle

## 5.1 Fantasy is a UX metaphor

The world should strongly evoke:

- exploration,
- a frontier,
- unexplored wilderness,
- ruins,
- hidden paths,
- mysterious landmarks,
- distant lights,
- ancient knowledge,
- magical gateways,
- a sense of a world larger than what the user can currently see.

## 5.2 Do NOT map categories 1:1 to fantasy objects

Bad:

> “Psychology category = Psychology Village”

This makes the metaphor shallow.

Better:

> The user encounters an abandoned observatory containing clues about human attention, then discovers that the clue connects to another area of the world.

The **experience of discovery** comes first. The category label may be revealed later.

## 5.3 Unknown should be visible

Use:

- fog,
- silhouettes,
- distant lights,
- partially visible structures,
- traces,
- broken roads,
- mysterious symbols,
- locked passages,
- sounds/animations suggesting something beyond the current view.

The user should see evidence of a larger world without seeing the entire answer.

---

# 6. Information model: preserve the current category tree, hide it behind the experience

The existing BubbleBreaker category tree is useful and should be treated as an underlying semantic graph.

Do not throw it away.

Instead, create a layer above it:

```text
EXISTING KNOWLEDGE GRAPH
    categories
    concepts
    relationships
    sources
           ↓
ADVENTURE EXPERIENCE LAYER
    clues
    encounters
    discoveries
    unexpected links
    exploration paths
           ↓
VISUAL WORLD
    terrain
    landmarks
    paths
    ruins
    gates
    revealed areas
```

The user primarily interacts with the Adventure Experience Layer.

---

# 7. The fundamental unit is not “page” — it is “discovery”

A discovery is a small unit that contains:

1. **Something encountered** — an object, clue, scene, question, fact, pattern, or connection.
2. **A short reveal** — enough information to create understanding without turning the moment into a long article.
3. **A connection** — why this discovery relates to the previous one.
4. **A new uncertainty** — something that naturally makes the user wonder what comes next.
5. **One or more next actions** — continue, investigate, drift, or return.

This is the basic narrative atom of BubbleBreaker.

---

# 8. Discovery hierarchy

There should be multiple kinds of discovery.

### Type A — Familiar discovery

A useful detail closely related to the user's starting theme.

Purpose: establish trust and momentum.

### Type B — Lateral discovery

A nearby but unexpected concept.

Purpose: stretch curiosity.

### Type C — Distant discovery

A topic far outside the user's usual area.

Purpose: break habitual browsing.

### Type D — Connection discovery

An apparently unrelated topic is shown to have a meaningful relationship with the previous one.

Purpose: create the strongest “aha” moment.

### Type E — World discovery

The user realizes the world is larger than previously visible: a new region, route, or unexplored structure becomes visible.

Purpose: create continuing adventure motivation.

---

# 9. The most important design rule: reveal first, label second

The user should often encounter the **phenomenon** before seeing the **category name**.

Example:

Bad:

> “Next category: Architecture”

Better:

> The user sees a strange city-like structure and notices that the streets seem designed to control where people look and move.
>
> The user investigates.
>
> Reveal: this connects to wayfinding and architecture.

The category becomes an explanation for the discovery, not the destination the user was ordered to visit.

---

# 10. Core interaction vocabulary

Avoid treating the interface as a conventional content site.

Preferred language:

| Conventional | BubbleBreaker concept |
|---|---|
| Search | Set out / begin from an interest |
| Result | Encounter |
| Related article | Clue / nearby trail |
| Recommendation | Opportunity / sign / lead |
| Category | Region / concept domain |
| History | Adventure journal |
| Open | Approach / investigate |
| Discover | Reveal / uncover |
| Random | Drift / unknown route |

The wording should remain understandable. Do not replace every familiar label with fantasy terminology if doing so hurts usability.

---

# 11. Five-minute experience: starting from “ゲーム”

This scenario is a **reference experience**, not a rigid scripted story. Codex should use it to implement the intended pacing and feeling.

## 11.1 0:00–0:20 — Departure

The user starts on a quiet frontier-like scene rather than a dense dashboard.

Primary prompt:

> **どこから旅を始めますか？**

The user selects:

> **ゲーム**

Important:

- Do not immediately show a giant category tree.
- Do not immediately list recommended articles.
- The user should feel like they have chosen a starting region, not a search filter.

---

## 11.2 0:20–0:50 — Arrival in a familiar region

The scene opens into a visually rich but partially obscured world.

The user recognizes visual hints of games:

- familiar game-like structures,
- abstract landmarks,
- interface fragments,
- playful environmental details.

However, the scene should contain at least one thing that does **not** obviously belong.

Example:

> A strange road disappearing into a city-like structure.

Or:

> A large sign/structure with an unexplained pattern.

Goal:

> Familiar enough to feel safe; strange enough to trigger curiosity.

---

## 11.3 0:50–1:30 — The first lure

Instead of a topic list, the system surfaces a curious clue.

Example prompt:

> **なぜ、人は“次の場所へ行きたくなる”ように作られた世界に惹かれるのだろう？**

The user can inspect it.

The experience should feel like following a question rather than opening an article.

---

## 11.4 1:30–2:10 — First discovery

The user uncovers a relationship between game-world design and the way physical spaces guide movement and attention.

The interface reveals a connection such as:

```text
GAME WORLD
    ↓
LEVEL / SPACE DESIGN
    ↓
WAYFINDING / HUMAN MOVEMENT
```

The user should think:

> “Wait. A game is not only about rules — its spaces are designed like real environments.”

This is the first “aha” target.

The exact factual content must be sourced/verified in the eventual knowledge layer.

---

## 11.5 2:10–2:40 — World expansion

The discovery should visibly change the world.

A previously obscured path becomes visible.

The user sees something new beyond it:

> a city / structure / bridge / distant light.

The system does not immediately explain everything.

Goal:

> **The reward for understanding is not points. The reward is a larger world.**

---

## 11.6 2:40–3:30 — Controlled drift

The user follows the newly opened path.

A second clue appears that is farther away from games.

Example direction:

> human attention → environment design → behavior

The system should avoid saying:

> “Recommended category: behavioral economics.”

Instead, the user encounters a phenomenon:

> “Why do some places make you naturally stop, move, look, or choose one route rather than another?”

The user investigates.

---

## 11.7 3:30–4:15 — Second connection

A new concept is revealed.

Possible conceptual chain:

```text
GAME DESIGN
   ↓
SPACE / LEVEL DESIGN
   ↓
WAYFINDING
   ↓
CHOICE / BEHAVIOR
```

The important thing is not the exact chain. The important thing is that:

> **The user can explain to themselves why the new idea is connected, while still feeling surprised that they encountered it.**

---

## 11.8 4:15–4:40 — The unexplained landmark

The user notices a new landmark that was previously invisible.

Do not immediately label it.

Examples:

- a gate,
- an observatory,
- a tower,
- a strange settlement,
- a light across the sea,
- a path beneath the ground.

This is the “I have to see what that is” moment.

---

## 11.9 4:40–5:00 — Choice driven by curiosity

Present three motivations rather than three categories.

```text
[ 追う ]
その謎をさらに追う

[ 寄り道 ]
別の気配を探す

[ 深く潜る ]
今見つけたものをもっと理解する
```

At least one option should lead farther outside the user's starting domain.

The interface should make the user want to continue without using artificial urgency or reward mechanics.

---

# 12. Wireframe principles

The wireframe is a **state model**, not a conventional page list.

## State A — Departure

```text
┌────────────────────────────────────────────┐
│                                            │
│          🌫 distant frontier 🌫            │
│                                            │
│              どこから旅を始めますか？      │
│                                            │
│        [ ゲーム ]   [ AI ]   [ 音楽 ]      │
│                                            │
│             [ 偶然に任せる ]               │
│                                            │
└────────────────────────────────────────────┘
```

Do not overcrowd this state.

---

## State B — Encounter

```text
┌────────────────────────────────────────────┐
│  ← 戻る                     冒険記 📜       │
│                                            │
│          distant landmark                  │
│                ↓                           │
│          ┌──────────┐                     │
│          │  ？？？   │                     │
│          └──────────┘                     │
│                                            │
│      「なぜ、人はここへ進みたくなる？」   │
│                                            │
│             [ 調べる ]                     │
│                                            │
└────────────────────────────────────────────┘
```

The visual scene should carry the user's attention before dense explanatory text does.

---

## State C — Reveal

```text
┌────────────────────────────────────────────┐
│                                            │
│              発見しました                 │
│                                            │
│          GAME WORLD                        │
│              │                             │
│              ↓                             │
│       SPACE / LEVEL DESIGN                 │
│              │                             │
│              ↓                             │
│          WAYFINDING                        │
│                                            │
│   「意外だけど、こういうつながりがある」 │
│                                            │
│               [ 世界を見る ]               │
└────────────────────────────────────────────┘
```

The relationship should be visually comprehensible in a few seconds.

---

## State D — Expansion

```text
┌────────────────────────────────────────────┐
│                                            │
│     revealed area                          │
│              ╲                             │
│               ╲                            │
│                ◉ current                  │
│                  ╲                         │
│                   ╲─── ???                 │
│                          ↑                  │
│                    new landmark            │
│                                            │
│       霧が晴れた。さらに先に何かある。      │
└────────────────────────────────────────────┘
```

The new landmark is more important than a list of next links.

---

## State E — Curiosity Choice

```text
┌────────────────────────────────────────────┐
│            この先、どうする？              │
│                                            │
│  [ 追う ]      [ 寄り道 ]     [ 深く潜る ] │
│                                            │
│  謎を追う      別の気配へ      理解を深める │
│                                            │
│        faint unknown signal → → →         │
└────────────────────────────────────────────┘
```

---

# 13. What should always be present on screen

Not every item must appear literally in every viewport, but the experience should maintain these signals:

1. **Current context** — user should know roughly where/what they are exploring.
2. **Uncertainty** — something is not yet understood.
3. **Evidence of a larger world** — something beyond the current knowledge boundary.
4. **A possible next action** — user can approach, inspect, drift, or deepen.
5. **A meaningful reward** — discovery changes what the user can see or understand.

---

# 14. Why the current category tree still matters

The category tree should not be exposed as the primary UI, but it remains important because it can provide:

- semantic relationships,
- candidate next concepts,
- topic neighborhoods,
- distance calculations,
- traversal history,
- discovery explanations.

The Adventure Experience Layer should transform these relationships into:

- clues,
- encounters,
- trails,
- bridges,
- landmarks,
- revelations,
- detours.

---

# 15. Serendipity engine requirements

## 15.1 Do not use pure random selection

Pure randomness may produce arbitrary and meaningless jumps.

## 15.2 Do not use only similarity

Similarity-only recommendation keeps the user inside the same bubble.

## 15.3 Target

Use a candidate set that balances:

- semantic relevance,
- novelty to the current user,
- distance from the current topic,
- strength of explainable connection,
- diversity across paths,
- previous exposure.

Conceptually:

```text
Candidate value
=
meaningful connection
+ novelty
+ surprise
+ explainability
- repetition
```

This is a product principle, not a mandatory mathematical formula for the first prototype.

---

# 16. Discovery explanation requirement

Whenever the system sends the user somewhere unexpected, it must be possible to answer:

> **“Why did I get here?”**

The explanation should be available at the moment of discovery, not hidden several clicks away.

The explanation can be visual:

```text
ゲーム
 ↓
「空間を設計する」
 ↓
人の動きを誘導する
 ↓
WAYFINDING
```

This converts surprise into understanding instead of confusion.

---

# 17. Adventure map requirement

The map is a **memory of exploration**, not the main menu.

The user should gradually build a map through discovery.

Initial state:

```text
██████ fog ██████
       ●
██████ fog ██████
```

After exploration:

```text
        ???
         │
    ●────●
    │    │
    ●────●───???
```

The map should make the user feel:

> “This world exists because I explored it.”

---

# 18. The role of the Adventure Journal

The journal records **discoveries and connections**, not just pages viewed.

Each entry should be able to show:

- what was discovered,
- where it came from,
- what unexpected connection was made,
- what became visible afterward.

Example:

```text
あなたの発見 #07

GAME → SPACE DESIGN → WAYFINDING

「ゲームの空間設計と、人が現実の空間を移動する仕組みに
共通する考え方がある。」

新しい道が開いた。
```

---

# 19. Anti-patterns — implementations that should be rejected

Reject or redesign an implementation when it becomes any of the following:

### A. Fantasy skin over a normal website

Cards, filters, categories, and recommendations remain unchanged while only the visual theme becomes fantasy.

### B. Category tour

User simply clicks:

> Game → Music → Psychology → Architecture

without experiencing clues, uncertainty, or discovery.

### C. Random-topic roulette

The service throws unrelated topics at the user without an explainable connection.

### D. Gamification-first

XP, levels, badges, rankings, currencies, or streaks become the main reason to continue.

### E. Map-first navigation

The user spends more effort panning around a map than following interesting discoveries.

### F. Exposition wall

The user must read large blocks of text before anything interesting happens.

### G. Fully revealed world

Everything is visible from the start, removing the feeling of frontier and discovery.

---

# 20. MVP scope

The first prototype should prove only one thing:

> **Can a user start from “ゲーム” and experience a genuine chain of curiosity → surprise → understanding → world expansion → desire to explore further?**

## Must-have

- departure state,
- “ゲーム” as starting interest,
- adventure scene,
- at least one visible unexplained lure,
- one discovery interaction,
- one explainable unexpected connection,
- visible world expansion after discovery,
- second curiosity trigger,
- three curiosity-driven continuation choices,
- minimal journal entry.

## Not required in MVP

- accounts,
- social features,
- rankings,
- character progression,
- combat,
- inventory,
- complex quest systems,
- full production-scale knowledge graph,
- exhaustive content coverage.

---

# 21. Prototype content requirements

For the prototype, content can be curated manually.

This is intentional.

Do not build a large recommendation engine before the core experience is validated.

A small number of high-quality discovery chains is more valuable than thousands of low-quality links.

Minimum recommended demo chain:

```text
ゲーム
  ↓
ゲーム空間 / レベルデザイン
  ↓
人の移動・視線・導線
  ↓
都市・建築・ウェイファインディング
  ↓
さらに離れた概念への枝分かれ
```

The exact claims and explanatory content must be sourced when implemented as factual content.

---

# 22. Technical architecture guidance

Prefer a layered architecture:

```text
Knowledge Graph / Content Data
        ↓
Connection Engine
        ↓
Adventure Event Generator
        ↓
World State
        ↓
UI / Animation / Audio
```

The UI should not contain the core discovery logic.

A future visual redesign should be possible without rewriting the semantic relationship engine.

---

# 23. World state

The client should conceptually maintain:

```text
currentConcept
visitedConcepts
revealedRegions
knownConnections
unexploredClues
adventurePath
sessionStartConcept
```

Optional later fields:

```text
noveltyHistory
surpriseHistory
userAffinityProfile
explorationStyle
```

Do not overbuild personalization during the first prototype.

---

# 24. Acceptance criteria for the first vertical slice

The prototype passes when all of these are true:

### A. Curiosity

A first-time user can identify at least one thing they want to investigate without being told which category to choose.

### B. Surprise

The user encounters at least one concept they did not expect from “ゲーム”.

### C. Explainability

The user can understand why the surprising concept is connected after the reveal.

### D. World expansion

The discovery causes a visible change in the explorable world.

### E. Continued curiosity

After the reveal, another unexplained thing is visible or suggested.

### F. Adventure feeling

The user experiences the sequence as exploration rather than content browsing.

### G. Bubble-breaking behavior

The flow must include at least one meaningful move outside the narrow semantic neighborhood of the starting interest.

### H. No gamification dependency

The user does not need XP, points, badges, or rankings to want to continue.

---

# 25. How Codex should approach the existing BubbleBreaker project

1. Read the current project before modifying it.
2. Identify the existing category graph and reusable components.
3. Do not delete the current system before the new vertical slice works.
4. Implement the Adventure Experience Layer as a separate layer/module where practical.
5. Start with curated content for the “ゲーム” journey.
6. Validate the experience with a working vertical slice.
7. Only after the vertical slice is compelling, generalize the content model and discovery logic.

The goal is **not** to rewrite everything immediately.

The goal is to create a new experience on top of reusable knowledge infrastructure.

---

# 26. Codex task order

## Phase 1 — Inspect

- inspect repository,
- inspect current category/data model,
- inspect existing UI,
- identify reusable components,
- document constraints.

## Phase 2 — Experience skeleton

Implement only:

- departure,
- encounter,
- reveal,
- expansion,
- curiosity choice.

Use curated mock data if necessary.

## Phase 3 — World response

Implement:

- fog,
- reveal animation,
- landmark emergence,
- path appearance,
- lightweight transition states.

## Phase 4 — Knowledge connection

Connect the existing semantic/category structure to the discovery flow.

## Phase 5 — Review

Evaluate the five-minute journey against the acceptance criteria before building additional systems.

---

# 27. The one question Codex must keep asking

> **“Does this implementation make the user more curious about what lies beyond the current understanding?”**

If the answer is no, the implementation should be reconsidered even if it is technically elegant.

---

# 28. Final product vision

BubbleBreaker should eventually create this feeling:

> “I came here because I was interested in games.”
>
> “I noticed something strange.”
>
> “I followed it.”
>
> “I discovered a connection I had never considered.”
>
> “That opened a new part of the world.”
>
> “Then I found another mystery.”
>
> “I kept going.”
>
> “And somehow, I ended up somewhere completely outside what I normally look at.”

That is the BubbleBreaker experience.

**Core principle:**

> ## Always leave something worth discovering beyond the current view.
