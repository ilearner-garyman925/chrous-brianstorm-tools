# Chorus

Chorus is a live discussion board for a teacher and a room of students. The teacher publishes a prompt. Students answer in a few sentences. The teacher can then group those answers into themes, a word cloud colored by theme, the tensions in the room, and a next question worth asking out loud.

It is meant for a seminar, a workshop, or a brainstorm: one sitting, one machine or one small server, up to a few dozen people.

Taking this over to finetune the screens and publish a room? Start with [HANDOVER.md](HANDOVER.md).

## Run it

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

- **Open the sample** loads a synthetic seminar, “How we use AI here,” with 32 student responses already grouped.
- **Watch the sample fill in** on the teacher desk clears that room and plays the responses back in, one at a time.
- **Host a discussion** opens a real room. The host key stays in this browser.
- Students join at `/join/CODE`.

```bash
npm test
npm run lint
```

## A language model

Without a key, Chorus groups responses from shared wording on this machine and says so on the desk. That path is what the sample and the tests use.

To group by meaning, copy `.env.example` to `.env.local` and set an OpenAI-compatible key:

```bash
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini
```

`OPENAI_API_KEY` is accepted if `LLM_API_KEY` is empty. Restart the dev server after changing it. If the model cannot be reached, the desk falls back to the local grouping and says why.

The model is asked to return themes, tensions, follow-up prompts, and cloud concepts, and to keep every response id. Chorus repairs a sloppy JSON reply: unknown ids are dropped, and any response the model skipped stays visible in a theme called “Left aside.”

## What a round does

1. The teacher publishes one question.
2. Students submit up to 1, 3, or 8 responses of at most 500 characters.
3. The desk shows a live cloud of the ideas, not only the raw words.
4. **Group the room** sends the visible responses to the model, or to the local grouper.
5. Present mode puts the cloud, the themes, or the tensions on the projector. Names are not on that screen.
6. A follow-up can be published as the next round. The previous round closes and stays readable.

Hide a response to drop it from the cloud and from the next grouping. Delete a room when the seminar is over. The sample room cannot be deleted; replay it instead.

Responses are stored in `data/chorus.json` on the server running Chorus. That file is local to the machine. Do not put this server on the public internet without a host gate of your own: anyone who can open the teacher URL for the sample can replay it, and a real room is only as private as its host key.

## Decisions worth challenging

These are the choices the first version is built on. They are easy to change if the room you teach works differently.

1. **No accounts.** A room code plus a host key kept in the teacher’s browser. Students are not logged in. This is for one sitting, not a term-long gradebook.
2. **Names are optional and never projected.** The teacher’s desk can tell voices apart (“Maya Chen”, “Unnamed · 3”). Present mode cannot. Calling on someone means looking at the laptop, not the board.
3. **Sentences, not only one word.** A classic word cloud accepts a sticker-word. Chorus accepts up to 500 characters so there is something qualitative to group. Short phrases still show up large in the cloud.
4. **The student cloud is off until the teacher turns it on.** Early answers anchor a room. The teacher always sees the cloud.
5. **The model does four jobs.** Themes with the actual quotes, a cloud of merged ideas, at most two tensions, and follow-up questions. It does not score students.
6. **Minority views stay visible.** A lone objection is not folded into the popular theme. The local grouper will leave a response in its own thread when it does not share wording with the rest.
7. **English interface.** Responses can be in another language when a model is configured. The offline grouper uses an English stopword list, so it is weak on other languages.
8. **Polling, not a socket.** The desk and the student page refresh about once a second. That is enough for a seminar and needs no extra service.
9. **Hide, don’t auto-censor.** A filter will silence slang and second-language phrasing. The teacher hides a line by hand.
10. **One file, one process.** Fine for a classroom laptop or a single server. Not a department platform.

## Sample data

The sample is a seminar answering “What should we change about how we use AI tools in this class?” The voices disagree on purpose: draft feedback, checking sources, paid access, keeping a voice, brainstorming then closing the tool, dependency and energy, plus two asides (a fuzzy projector, and a request for office hours). The offline grouper is tested against that set. It groups by wording, so the sample repeats the phrases students would actually reuse. A model is what you want when the room uses different words for the same idea.
