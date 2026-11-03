import { randomBytes, timingSafeEqual } from "crypto";
import fs from "fs";
import path from "path";
import { DEMO_CODE, DEMO_HOST_KEY } from "@/lib/demo";
import { ChorusError } from "@/lib/errors";
import { groupLocally, liveConcepts } from "@/lib/group";
import { groupWithModel, llmConfig } from "@/lib/llm";
import { SAMPLE_LINES, SAMPLE_PROMPT, SAMPLE_TITLE, type SampleLine } from "@/lib/sample";
import type {
  Analysis,
  Concept,
  CreateRoomInput,
  HostSnapshot,
  RoundStatus,
  StudentSnapshot,
} from "@/lib/types";

type Room = {
  id: string;
  code: string;
  hostKey: string;
  title: string;
  createdAt: number;
  isDemo: boolean;
  showCloudToStudents: boolean;
  maxPerPerson: number;
  askForNames: boolean;
};

type Round = {
  id: string;
  roomId: string;
  index: number;
  prompt: string;
  status: RoundStatus;
  createdAt: number;
};

type Participant = {
  id: string;
  roomId: string;
  token: string;
  displayName: string | null;
  unnamedIndex: number | null;
  scriptKey: string | null;
  createdAt: number;
};

type ResponseRow = {
  id: string;
  roundId: string;
  participantId: string;
  text: string;
  hidden: boolean;
  createdAt: number;
};

type DB = {
  rooms: Room[];
  rounds: Round[];
  participants: Participant[];
  responses: ResponseRow[];
  analyses: Analysis[];
};

type ReplayState = {
  cursor: number;
  total: number;
  code: string;
  timer: ReturnType<typeof setInterval> | null;
};

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function runtime() {
  const globalStore = globalThis as typeof globalThis & {
    __chorusRuntime?: { replay: ReplayState | null };
  };
  if (!globalStore.__chorusRuntime) globalStore.__chorusRuntime = { replay: null };
  return globalStore.__chorusRuntime;
}

function dataFile() {
  return process.env.CHORUS_DATA || path.join(process.cwd(), "data", "chorus.json");
}

function emptyDb(): DB {
  return { rooms: [], rounds: [], participants: [], responses: [], analyses: [] };
}

function writeDb(db: DB) {
  const file = dataFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, file);
}

function readDb(): DB {
  const file = dataFile();
  if (!fs.existsSync(file)) {
    const db = emptyDb();
    if (process.env.CHORUS_SKIP_SEED !== "1") insertDemo(db, "full");
    writeDb(db);
    return db;
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as DB;
  } catch {
    throw new ChorusError("The discussion file on this server could not be read.", 500);
  }
}

function updateDb<T>(fn: (db: DB) => T): T {
  const db = readDb();
  const result = fn(db);
  writeDb(db);
  return result;
}

function rid(prefix: string) {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function keysMatch(given: string, expected: string) {
  const left = Buffer.from(given);
  const right = Buffer.from(expected);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function cleanLine(value: unknown, label: string, max: number) {
  if (typeof value !== "string") throw new ChorusError(`${label} is missing.`, 400);
  const text = value.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  if (text.length < 1 || text.length > max) {
    throw new ChorusError(`${label} needs 1–${max} characters.`, 400);
  }
  return text;
}

function cleanResponse(value: unknown) {
  if (typeof value !== "string") throw new ChorusError("Write a response first.", 400);
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) throw new ChorusError("Write a response first.", 400);
  if (text.length > 500) throw new ChorusError("Keep it to 500 characters.", 400);
  return text;
}

function cleanName(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new ChorusError("That name is not valid.", 400);
  const text = value.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (text.length > 40) throw new ChorusError("Names can be at most 40 characters.", 400);
  return text;
}

function mustRoom(db: DB, code: string) {
  const normalized = code.trim().toUpperCase();
  const room = db.rooms.find((item) => item.code === normalized);
  if (!room) throw new ChorusError("No room with that code.", 404);
  return room;
}

function mustHost(db: DB, code: string, hostKey: string) {
  const room = mustRoom(db, code);
  if (!keysMatch(hostKey, room.hostKey)) {
    throw new ChorusError("That host key does not open this room.", 401);
  }
  return room;
}

function latestRound(db: DB, room: Room) {
  const rounds = db.rounds.filter((round) => round.roomId === room.id);
  if (rounds.length === 0) throw new ChorusError("This room has no question yet.", 404);
  return rounds.reduce((latest, round) => (round.index > latest.index ? round : latest));
}

function mustParticipant(db: DB, room: Room, token: string) {
  const participant = db.participants.find(
    (item) => item.roomId === room.id && keysMatch(token, item.token),
  );
  if (!participant) throw new ChorusError("This seat is no longer valid. Join again.", 401);
  return participant;
}

function labelFor(participant: Participant) {
  if (participant.displayName) return participant.displayName;
  return `Unnamed · ${participant.unnamedIndex ?? 1}`;
}

function publicParticipant(participant: Participant) {
  return {
    id: participant.id,
    label: labelFor(participant),
    sharedName: participant.displayName !== null,
  };
}

function stopReplay() {
  const state = runtime();
  if (state.replay?.timer) clearInterval(state.replay.timer);
  state.replay = null;
}

function addScripted(db: DB, line: SampleLine, createdAt: number) {
  const room = db.rooms.find((item) => item.code === DEMO_CODE);
  if (!room) return;
  const round = latestRound(db, room);
  let participant = db.participants.find(
    (item) => item.roomId === room.id && item.scriptKey === line.who,
  );
  if (!participant) {
    participant = {
      id: rid("p"),
      roomId: room.id,
      token: randomBytes(18).toString("hex"),
      displayName: line.name,
      unnamedIndex: line.name
        ? null
        : db.participants.filter((item) => item.roomId === room.id && !item.displayName).length +
          1,
      scriptKey: line.who,
      createdAt,
    };
    db.participants.push(participant);
  }
  db.responses.push({
    id: rid("r"),
    roundId: round.id,
    participantId: participant.id,
    text: line.text,
    hidden: false,
    createdAt,
  });
}

function insertDemo(db: DB, mode: "full" | "shell") {
  const now = Date.now();
  const room: Room = {
    id: rid("room"),
    code: DEMO_CODE,
    hostKey: DEMO_HOST_KEY,
    title: SAMPLE_TITLE,
    createdAt: now,
    isDemo: true,
    showCloudToStudents: false,
    maxPerPerson: 4,
    askForNames: true,
  };
  const started = now - SAMPLE_LINES.length * 20_000;
  db.rooms.push(room);
  db.rounds.push({
    id: rid("round"),
    roomId: room.id,
    index: 1,
    prompt: SAMPLE_PROMPT,
    status: "open",
    createdAt: started,
  });
  if (mode === "shell") return;
  SAMPLE_LINES.forEach((line, index) => addScripted(db, line, started + (index + 1) * 20_000));
  const round = latestRound(db, room);
  const items = db.responses
    .filter((response) => response.roundId === round.id && !response.hidden)
    .map((response) => ({ id: response.id, text: response.text }));
  db.analyses.push({
    ...groupLocally(round.prompt, items),
    id: rid("an"),
    roundId: round.id,
    createdAt: now,
    source: "local",
    model: null,
    warning: null,
  });
}

function removeDemo(db: DB) {
  const room = db.rooms.find((item) => item.code === DEMO_CODE);
  if (!room) return;
  const roundIds = new Set(
    db.rounds.filter((round) => round.roomId === room.id).map((round) => round.id),
  );
  db.responses = db.responses.filter((response) => !roundIds.has(response.roundId));
  db.analyses = db.analyses.filter((analysis) => !roundIds.has(analysis.roundId));
  db.rounds = db.rounds.filter((round) => round.roomId !== room.id);
  db.participants = db.participants.filter((participant) => participant.roomId !== room.id);
  db.rooms = db.rooms.filter((item) => item.id !== room.id);
}

function visibleItems(db: DB, roundId: string) {
  return db.responses
    .filter((response) => response.roundId === roundId && !response.hidden)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((response) => ({ id: response.id, text: response.text }));
}

function conceptsFor(prompt: string, items: { id: string; text: string }[], analysis: Analysis | null) {
  if (!analysis) return { concepts: liveConcepts(prompt, items), freshCount: 0 };
  const covered = new Set(analysis.themes.flatMap((theme) => theme.responseIds));
  const fresh = items.filter((item) => !covered.has(item.id));
  const extra: Concept[] = liveConcepts(prompt, fresh).map((concept) => ({
    ...concept,
    themeId: "fresh",
    weight: Math.min(4, concept.weight),
  }));
  return { concepts: [...analysis.concepts, ...extra], freshCount: fresh.length };
}

function roundViews(db: DB, room: Room) {
  return db.rounds
    .filter((round) => round.roomId === room.id)
    .sort((a, b) => a.index - b.index)
    .map((round) => {
      const analysis = db.analyses.find((item) => item.roundId === round.id) ?? null;
      const cloud = conceptsFor(round.prompt, visibleItems(db, round.id), analysis);
      return {
        id: round.id,
        index: round.index,
        prompt: round.prompt,
        status: round.status,
        createdAt: round.createdAt,
        concepts: cloud.concepts,
        freshCount: cloud.freshCount,
      };
    });
}

function makeCode(db: DB) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = [...randomBytes(4)]
      .map((byte) => ALPHABET[byte % ALPHABET.length])
      .join("");
    if (code === DEMO_CODE) continue;
    if (!db.rooms.some((room) => room.code === code)) return code;
  }
  throw new ChorusError("Could not open a room code. Try again.", 500);
}

export function resetStoreForTests() {
  stopReplay();
  const file = dataFile();
  if (fs.existsSync(file)) fs.unlinkSync(file);
  const tmp = `${file}.tmp`;
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
}

export function createRoom(input: CreateRoomInput) {
  const title = cleanLine(input.title, "The title", 80);
  const prompt = cleanLine(input.prompt, "The prompt", 280);
  if (![1, 3, 8].includes(input.maxPerPerson)) {
    throw new ChorusError("Responses per person must be 1, 3, or 8.", 400);
  }
  return updateDb((db) => {
    const room: Room = {
      id: rid("room"),
      code: makeCode(db),
      hostKey: randomBytes(18).toString("hex"),
      title,
      createdAt: Date.now(),
      isDemo: false,
      showCloudToStudents: input.showCloudToStudents,
      maxPerPerson: input.maxPerPerson,
      askForNames: input.askForNames,
    };
    db.rooms.push(room);
    db.rounds.push({
      id: rid("round"),
      roomId: room.id,
      index: 1,
      prompt,
      status: "open",
      createdAt: Date.now(),
    });
    return { code: room.code, hostKey: room.hostKey, title: room.title };
  });
}

export function joinRoom(code: string, displayName: string | null) {
  return updateDb((db) => {
    const room = mustRoom(db, code);
    const name = room.askForNames ? cleanName(displayName) : null;
    const participant: Participant = {
      id: rid("p"),
      roomId: room.id,
      token: randomBytes(18).toString("hex"),
      displayName: name,
      unnamedIndex: name
        ? null
        : db.participants.filter((item) => item.roomId === room.id && !item.displayName).length +
          1,
      scriptKey: null,
      createdAt: Date.now(),
    };
    db.participants.push(participant);
    return { token: participant.token, participant: publicParticipant(participant) };
  });
}

export function submitResponse(code: string, token: string, text: string) {
  const clean = cleanResponse(text);
  return updateDb((db) => {
    const room = mustRoom(db, code);
    const participant = mustParticipant(db, room, token);
    const round = latestRound(db, room);
    if (round.status !== "open") throw new ChorusError("This round is closed.", 409);
    const sent = db.responses.filter(
      (response) => response.roundId === round.id && response.participantId === participant.id,
    ).length;
    if (sent >= room.maxPerPerson) {
      throw new ChorusError(
        room.maxPerPerson === 1
          ? "You've already sent your response for this round."
          : `You've sent your ${room.maxPerPerson} responses for this round.`,
        409,
      );
    }
    const response: ResponseRow = {
      id: rid("r"),
      roundId: round.id,
      participantId: participant.id,
      text: clean,
      hidden: false,
      createdAt: Date.now(),
    };
    db.responses.push(response);
    return { id: response.id, text: response.text };
  });
}

export function setResponseHidden(code: string, hostKey: string, responseId: string, hidden: boolean) {
  updateDb((db) => {
    const room = mustHost(db, code, hostKey);
    const roundIds = new Set(
      db.rounds.filter((round) => round.roomId === room.id).map((round) => round.id),
    );
    const response = db.responses.find((item) => item.id === responseId);
    if (!response || !roundIds.has(response.roundId)) {
      throw new ChorusError("That response is not in this room.", 404);
    }
    response.hidden = hidden;
  });
}

export function setCloudVisibility(code: string, hostKey: string, showCloudToStudents: boolean) {
  updateDb((db) => {
    const room = mustHost(db, code, hostKey);
    room.showCloudToStudents = showCloudToStudents;
  });
}

export function setLatestLocked(code: string, hostKey: string, locked: boolean) {
  updateDb((db) => {
    const room = mustHost(db, code, hostKey);
    latestRound(db, room).status = locked ? "locked" : "open";
  });
}

export function openRound(code: string, hostKey: string, prompt: string) {
  const clean = cleanLine(prompt, "The prompt", 280);
  return updateDb((db) => {
    const room = mustHost(db, code, hostKey);
    for (const round of db.rounds) {
      if (round.roomId === room.id && round.status === "open") round.status = "locked";
    }
    const index =
      db.rounds
        .filter((round) => round.roomId === room.id)
        .reduce((max, round) => Math.max(max, round.index), 0) + 1;
    const round: Round = {
      id: rid("round"),
      roomId: room.id,
      index,
      prompt: clean,
      status: "open",
      createdAt: Date.now(),
    };
    db.rounds.push(round);
    return { id: round.id, index: round.index, prompt: round.prompt };
  });
}

export function deleteRoom(code: string, hostKey: string) {
  updateDb((db) => {
    const room = mustHost(db, code, hostKey);
    if (room.isDemo) {
      throw new ChorusError("The sample room stays. Replay it instead.", 400);
    }
    const roundIds = new Set(
      db.rounds.filter((round) => round.roomId === room.id).map((round) => round.id),
    );
    db.responses = db.responses.filter((response) => !roundIds.has(response.roundId));
    db.analyses = db.analyses.filter((analysis) => !roundIds.has(analysis.roundId));
    db.rounds = db.rounds.filter((round) => round.roomId !== room.id);
    db.participants = db.participants.filter((participant) => participant.roomId !== room.id);
    db.rooms = db.rooms.filter((item) => item.id !== room.id);
  });
}

export function studentView(code: string, token: string | null): StudentSnapshot {
  const db = readDb();
  const room = mustRoom(db, code);
  const round = latestRound(db, room);
  const participant = token ? mustParticipant(db, room, token) : null;
  const mine = participant
    ? db.responses.filter((response) => response.participantId === participant.id)
    : [];
  const analysis = db.analyses.find((item) => item.roundId === round.id) ?? null;
  const visible = visibleItems(db, round.id);
  const cloud = conceptsFor(round.prompt, visible, analysis);
  const show = room.showCloudToStudents && participant !== null;
  return {
    room: {
      code: room.code,
      title: room.title,
      askForNames: room.askForNames,
      maxPerPerson: room.maxPerPerson,
      showCloudToStudents: room.showCloudToStudents,
    },
    round: {
      id: round.id,
      index: round.index,
      prompt: round.prompt,
      status: round.status,
    },
    joined: participant !== null,
    me: participant ? publicParticipant(participant) : null,
    myResponses: mine.map((response) => {
      const owner = db.rounds.find((item) => item.id === response.roundId);
      return {
        id: response.id,
        roundId: response.roundId,
        roundIndex: owner?.index ?? 1,
        prompt: owner?.prompt ?? "",
        text: response.text,
      };
    }),
    responseCount: visible.length,
    concepts: show ? cloud.concepts : null,
    legend:
      show && analysis
        ? [
            ...analysis.themes.map((theme) => ({ id: theme.id, label: theme.label })),
            ...(cloud.freshCount > 0 ? [{ id: "fresh", label: "Since the grouping" }] : []),
          ]
        : null,
  };
}

export function hostView(code: string, hostKey: string): HostSnapshot {
  const db = readDb();
  const room = mustHost(db, code, hostKey);
  const rounds = roundViews(db, room);
  const active = latestRound(db, room);
  const replay = runtime().replay;
  return {
    room: {
      code: room.code,
      title: room.title,
      createdAt: room.createdAt,
      isDemo: room.isDemo,
      showCloudToStudents: room.showCloudToStudents,
      maxPerPerson: room.maxPerPerson,
      askForNames: room.askForNames,
    },
    rounds,
    activeRoundId: active.id,
    responses: db.responses
      .filter((response) => rounds.some((round) => round.id === response.roundId))
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((response) => {
        const participant = db.participants.find((item) => item.id === response.participantId);
        return {
          id: response.id,
          roundId: response.roundId,
          text: response.text,
          hidden: response.hidden,
          createdAt: response.createdAt,
          participant: participant
            ? publicParticipant(participant)
            : { id: "gone", label: "Left the room", sharedName: false },
        };
      }),
    analyses: db.analyses.filter((analysis) => rounds.some((round) => round.id === analysis.roundId)),
    llm: { configured: llmConfig().configured, model: llmConfig().model },
    replay:
      replay && replay.code === room.code
        ? { running: true, cursor: replay.cursor, total: replay.total }
        : null,
  };
}

export async function analyzeRound(code: string, hostKey: string, roundId?: string | null) {
  const db = readDb();
  const room = mustHost(db, code, hostKey);
  const round = roundId
    ? db.rounds.find((item) => item.id === roundId && item.roomId === room.id)
    : latestRound(db, room);
  if (!round) throw new ChorusError("That round is not in this room.", 404);
  const items = visibleItems(db, round.id);
  if (items.length < 2) {
    throw new ChorusError("Wait for at least two visible responses before grouping.", 400);
  }
  const modelResult = await groupWithModel(round.prompt, items);
  const draft = modelResult.draft ?? groupLocally(round.prompt, items);
  const analysis: Analysis = {
    ...draft,
    id: rid("an"),
    roundId: round.id,
    createdAt: Date.now(),
    source: modelResult.draft ? "llm" : "local",
    model: modelResult.model,
    warning: modelResult.draft ? null : modelResult.warning,
  };
  return updateDb((next) => {
    if (!next.rounds.some((item) => item.id === round.id)) {
      throw new ChorusError("That round is not in this room.", 404);
    }
    next.analyses = next.analyses.filter((item) => item.roundId !== round.id);
    next.analyses.push(analysis);
    return analysis;
  });
}

function tickReplay() {
  const state = runtime();
  if (!state.replay) return;
  if (state.replay.cursor >= SAMPLE_LINES.length) {
    stopReplay();
    return;
  }
  const line = SAMPLE_LINES[state.replay.cursor]!;
  state.replay.cursor += 1;
  updateDb((db) => addScripted(db, line, Date.now()));
  if (state.replay && state.replay.cursor >= SAMPLE_LINES.length) stopReplay();
}

export function startReplay(code: string, hostKey: string, options?: { timer?: boolean }) {
  const db = readDb();
  const room = mustHost(db, code, hostKey);
  if (!room.isDemo) throw new ChorusError("Replay is only available on the sample room.", 400);
  stopReplay();
  updateDb((next) => {
    removeDemo(next);
    insertDemo(next, "shell");
  });
  const replay: ReplayState = {
    cursor: 0,
    total: SAMPLE_LINES.length,
    code: DEMO_CODE,
    timer: null,
  };
  runtime().replay = replay;
  if (options?.timer !== false) {
    replay.timer = setInterval(tickReplay, 800);
  }
  return { total: SAMPLE_LINES.length };
}

export function pumpReplay() {
  const state = runtime();
  if (!state.replay) return false;
  tickReplay();
  return runtime().replay !== null;
}

export function restoreDemo(code: string, hostKey: string) {
  const db = readDb();
  const room = db.rooms.find((item) => item.code === code.trim().toUpperCase());
  if (room) mustHost(db, code, hostKey);
  else if (code.trim().toUpperCase() !== DEMO_CODE || !keysMatch(hostKey, DEMO_HOST_KEY)) {
    throw new ChorusError("That host key does not open this room.", 401);
  }
  if (room && !room.isDemo) {
    throw new ChorusError("Replay is only available on the sample room.", 400);
  }
  stopReplay();
  updateDb((next) => {
    removeDemo(next);
    insertDemo(next, "full");
  });
}

export function ensureDemo() {
  updateDb((db) => {
    if (!db.rooms.some((room) => room.code === DEMO_CODE)) insertDemo(db, "full");
  });
}

export function assertRoom(code: string) {
  mustRoom(readDb(), code);
}
