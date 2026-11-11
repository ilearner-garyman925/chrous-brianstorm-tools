# Handing Chorus to the next person

Chorus is a live discussion board. A teacher publishes one question. Students answer in sentences. The teacher groups those answers into a word cloud, themes, tensions, and a next question, then puts that on a projector.

This file is the map for finetuning the details and publishing a room. The product choices already in the code are listed in the README under “Decisions worth challenging.” Change those on purpose. The tests in `tests/chorus.test.ts` lock the ones that protect a real seminar: every response stays visible, names stay off the student view, and the sample still groups into the threads it was written for.

## Get the code

The repository is private: [alansze/think-cloud](https://cursor.com/codebase/alansze/think-cloud). Someone with access has to add you on that page before a clone will succeed.

On macOS or Linux:

```bash
curl -fsSL https://downloads.cursor.com/origin/install.sh | sh
origin auth login
origin repo clone alansze/think-cloud
cd think-cloud
npm install
npm run dev
```

On Windows, run that in WSL. The Origin CLI does not run in PowerShell. If `origin` is not found after install:

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

Open http://127.0.0.1:43123 and click **Open the sample**. The desk should show “How we use AI here,” about 32 responses, and a cloud of colored bubbles. Click a bubble to read the lines behind it. **Present** is the projector: the same cloud, without names.

Node 22 is what this copy was built with. `npm test` and `npm run lint` should both pass before you change behavior.

## Where to finetune

| What you want to change | Where it lives |
| --- | --- |
| Colors, type, page background | `src/app/globals.css` (`:root`) and `src/app/layout.tsx` (Fraunces and Outfit) |
| Word mark and tagline | `src/components/brand.tsx` |
| Home page copy and the preview cloud | `src/components/home-screen.tsx` |
| Teacher desk, invite, present screen | `src/components/desk.tsx` |
| Bubble shape, drift, and the card that opens on click | `src/components/word-cloud.tsx` and the `chorus-drift` keyframes in `src/app/globals.css` |
| Theme cards and the tension spectra | `src/components/theme-board.tsx`, `src/components/tension-board.tsx` |
| Student join and reply box | `src/components/join-room.tsx` |
| Which lines a clicked word opens | `src/lib/concept-detail.ts` |
| Offline grouping, theme names, tensions | `src/lib/group.ts`, stopwords and stemming in `src/lib/text.ts` |
| The instruction sent to the model | The `SYSTEM` string at the top of `src/lib/llm.ts` |
| The synthetic seminar | `src/lib/sample.ts` |
| Response length, replies per person, room codes | `src/lib/store.ts` |
| Palette of bubble colors | `src/lib/colors.ts` |

The sample room code is `DEMO` and its host key is `demo-host-key` (`src/lib/demo.ts`). Anyone who can open the site can replay that room. That is fine for a demonstration. A real room is gated only by the host key stored in the teacher’s browser.

Copy `.env.example` to `.env.local` when you want grouping by meaning. Leave the key empty to keep the offline grouper, which is what the tests use. Restart the dev server after changing it.

```bash
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=
LLM_MODEL=gpt-4o-mini
```

`OPENAI_API_KEY` is read if `LLM_API_KEY` is empty. If the model fails, the desk falls back to shared-wording grouping and says so. Unknown response ids are dropped. Any response the model skips stays in a theme called “Left aside.”

## Publish it

Chorus is a Next.js app with its own API. It is not a static site. Rooms, responses, and groupings are one JSON file on the server:

```bash
# default: ./data/chorus.json
CHORUS_DATA=/var/lib/chorus/chorus.json
```

`data/` is gitignored. The file has to live on a disk that stays with that one Node process. A serverless host, or two copies of the app behind a load balancer, will split or drop the discussion. Publish it as one long-running server.

On that machine:

```bash
npm install
npm run build
npm run start
```

`npm run start` listens on port 43123. Put the process behind HTTPS. Set `LLM_API_KEY` in the server environment if you want model grouping, and point `CHORUS_DATA` at a persistent path. Do not commit `.env.local`.

Before a real class:

1. Open a room from **Host a discussion** and join it from a second browser as a student.
2. Send two responses, click **Group the room**, then **Present**, and click a bubble.
3. Confirm the projector card has quotes and no student names.
4. Keep the host key. It is the only way back to that desk.

The teacher URL for a real room is only as private as that key. The sample room is not a private room.
