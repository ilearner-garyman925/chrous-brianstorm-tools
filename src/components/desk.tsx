"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/components/api";
import { Brand } from "@/components/brand";
import { RoomFallback } from "@/components/room-fallback";
import { TensionBoard } from "@/components/tension-board";
import { ThemeBoard } from "@/components/theme-board";
import { usePoll } from "@/components/use-poll";
import { WordCloud } from "@/components/word-cloud";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useHydrated, useStoredValue } from "@/components/stored";
import { DEMO_CODE, DEMO_HOST_KEY } from "@/lib/demo";
import { discussionMarkdown } from "@/lib/markdown";
import type { HostResponse, HostSnapshot } from "@/lib/types";

type View = "cloud" | "themes" | "tensions";

function ago(timestamp: number) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

export function Desk({ code }: { code: string }) {
  const router = useRouter();
  const storageKey = `chorus.host.${code}`;
  const hydrated = useHydrated();
  const [storedKey, setStoredKey] = useStoredValue(storageKey);
  const hostKey = code === DEMO_CODE ? DEMO_HOST_KEY : storedKey;
  const [pastedKey, setPastedKey] = useState("");
  const [pinned, setPinned] = useState<string | null>(null);
  const [view, setView] = useState<View>("cloud");
  const [present, setPresent] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [replayOpen, setReplayOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [glow, setGlow] = useState<string[]>([]);
  const seen = useRef(new Set<string>());

  const headers = useMemo(() => {
    const next: Record<string, string> = {};
    if (hostKey) next["x-host-key"] = hostKey;
    return next;
  }, [hostKey]);
  const onPollError = useCallback(
    (message: string) => {
      if (code !== DEMO_CODE && /host key/i.test(message)) setStoredKey(null);
    },
    [code, setStoredKey],
  );
  const poll = usePoll<HostSnapshot>(hostKey ? `/api/rooms/${code}/host` : null, headers, onPollError);
  const data = poll.data;
  const selected = pinned ?? data?.activeRoundId ?? null;

  useEffect(() => {
    if (!data) return;
    const ids = data.responses.map((response) => response.id);
    const newcomers = ids.filter((id) => !seen.current.has(id));
    if (seen.current.size > 0 && newcomers.length > 0) {
      setGlow(newcomers);
      const timer = window.setTimeout(() => setGlow([]), 2400);
      for (const id of ids) seen.current.add(id);
      return () => window.clearTimeout(timer);
    }
    for (const id of ids) seen.current.add(id);
  }, [data]);

  useEffect(() => {
    if (!present) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "Escape") setPresent(false);
      if (event.key === "c" || event.key === "C") setView("cloud");
      if (event.key === "t" || event.key === "T") setView("themes");
      if (event.key === "s" || event.key === "S") setView("tensions");
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [present]);

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label);
    setActionError(null);
    try {
      await task();
      await poll.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  }

  if (!hydrated || (hostKey && !data && !poll.error)) {
    return <RoomFallback label="Opening the teacher desk…" />;
  }

  if (!hostKey) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4">
        <Brand />
        <h1 className="font-serif text-4xl">This desk needs its key.</h1>
        <p className="text-sm leading-relaxed text-[#5c5348]">
          The host key was saved in the browser that opened the room. Paste it to moderate from this one.
        </p>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const next = pastedKey.trim();
            if (!next) return;
            setStoredKey(next);
          }}
        >
          <Label htmlFor="host-key">Host key</Label>
          <Textarea id="host-key" value={pastedKey} onChange={(event) => setPastedKey(event.target.value)} />
          <Button type="submit" size="touch">
            Open the desk
          </Button>
        </form>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-4">
        <Brand />
        <h1 className="font-serif text-4xl">{poll.error || "The room is not available."}</h1>
      </div>
    );
  }

  const round = data.rounds.find((item) => item.id === selected) ?? data.rounds[data.rounds.length - 1];
  if (!round) return <RoomFallback label="This room has no question yet." />;
  const analysis = data.analyses.find((item) => item.roundId === round.id) ?? null;
  const responses = data.responses.filter((item) => item.roundId === round.id);
  const visibleCount = responses.filter((item) => !item.hidden).length;
  const latest = data.rounds[data.rounds.length - 1]!;
  const isLatest = round.id === latest.id;
  const themeIds = analysis?.themes.map((theme) => theme.id) ?? [];
  const legend = [
    ...(analysis?.themes.map((theme) => ({ id: theme.id, label: theme.label })) ?? []),
    ...(round.freshCount > 0 ? [{ id: "fresh", label: "Since the grouping" }] : []),
  ];
  const auth = { "x-host-key": hostKey };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Brand />
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="h-8 px-3 font-mono text-sm tracking-[0.25em]">
            {data.room.code}
          </Badge>
          <Button variant="outline" onClick={() => setInviteOpen(true)}>
            Invite
          </Button>
          <Button onClick={() => setPresent(true)}>Present</Button>
        </div>
      </header>

      <div>
        <p className="text-sm text-[#5c5348]">{data.room.title}</p>
        <h1 className="mt-2 max-w-4xl font-serif text-4xl leading-tight sm:text-5xl">{round.prompt}</h1>
        <p className="mt-3 text-sm text-[#5c5348]" aria-live="polite">
          {visibleCount} visible {visibleCount === 1 ? "response" : "responses"}
          {data.rounds.length > 1 ? ` · Round ${round.index} of ${data.rounds.length}` : ""}
          {data.replay?.running ? ` · Playing the sample, ${data.replay.cursor} of ${data.replay.total}` : ""}
        </p>
      </div>

      {data.rounds.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {data.rounds.map((item) => (
            <Button
              key={item.id}
              variant={item.id === round.id ? "default" : "outline"}
              onClick={() => {
                setPinned(item.id === data.activeRoundId ? null : item.id);
              }}
            >
              Round {item.index}
              {item.status === "locked" ? " · closed" : ""}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ochre"
          size="touch"
          disabled={busy !== null || visibleCount < 2}
          onClick={() =>
            run("group", async () => {
              await api(`/api/rooms/${code}/analyze`, { json: { roundId: round.id }, headers: auth });
              setView("themes");
            })
          }
        >
          {busy === "group" ? "Reading the room…" : analysis ? "Group again" : "Group the room"}
        </Button>
        {isLatest ? (
          <Button
            variant="outline"
            size="touch"
            disabled={busy !== null}
            onClick={() =>
              run("lock", async () => {
                await api(`/api/rooms/${code}/rounds`, {
                  json: { action: latest.status === "open" ? "lock" : "unlock" },
                  headers: auth,
                });
              })
            }
          >
            {latest.status === "open" ? "Close this round" : "Reopen this round"}
          </Button>
        ) : (
          <p className="text-sm text-[#5c5348]">This round is closed. The live round is Round {latest.index}.</p>
        )}
        <div className="flex items-center gap-2">
          <Switch
            id="student-cloud"
            checked={data.room.showCloudToStudents}
            onCheckedChange={(checked) =>
              run("cloud", async () => {
                await api(`/api/rooms/${code}`, {
                  method: "PATCH",
                  json: { showCloudToStudents: checked },
                  headers: auth,
                });
              })
            }
          />
          <Label htmlFor="student-cloud" className="font-normal">
            Students can see the cloud
          </Label>
        </div>
        {analysis ? (
          <Button
            variant="ghost"
            onClick={async () => {
              await navigator.clipboard.writeText(discussionMarkdown(data, round.id));
              toast.success("Summary copied.");
            }}
          >
            Copy summary
          </Button>
        ) : null}
      </div>

      {visibleCount < 2 ? (
        <p className="text-sm text-[#5c5348]">Grouping starts at two visible responses. One voice is not a pattern yet.</p>
      ) : null}
      {analysis ? (
        <p className="text-sm text-[#5c5348]">
          {analysis.source === "llm"
            ? `Grouped by ${analysis.model}.`
            : analysis.warning ||
              (data.llm.configured
                ? "Grouped from shared wording on this machine."
                : "Grouped from shared wording on this machine. Add an LLM key to group by meaning and write sharper names.")}
          {round.freshCount > 0
            ? ` ${round.freshCount} ${round.freshCount === 1 ? "response has" : "responses have"} arrived since.`
            : ""}
        </p>
      ) : null}
      {actionError ? <p className="text-sm text-[#9c3b3b]">{actionError}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="min-w-0 space-y-4">
          <Tabs
            value={view}
            onValueChange={(value) => {
              if (value === "cloud" || value === "themes" || value === "tensions") setView(value);
            }}
          >
            <TabsList>
              <TabsTrigger value="cloud">Cloud</TabsTrigger>
              <TabsTrigger value="themes">Themes</TabsTrigger>
              <TabsTrigger value="tensions">Tensions</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className={view === "cloud" ? "h-[28rem]" : ""}>
            {view === "cloud" ? (
              <WordCloud concepts={round.concepts} themeIds={themeIds} tone="paper" legend={legend} />
            ) : null}
            {view === "themes" ? (
              <ThemeBoard
                overview={analysis?.overview ?? "The threads appear after you group the room."}
                themes={analysis?.themes ?? []}
                responses={responses}
                tone="paper"
              />
            ) : null}
            {view === "tensions" ? (
              <TensionBoard
                tensions={analysis?.tensions ?? []}
                themes={analysis?.themes ?? []}
                responses={responses.filter((item) => !item.hidden)}
                tone="paper"
                grouped={Boolean(analysis)}
              />
            ) : null}
          </div>
          {view === "cloud" && round.concepts.length > 0 ? (
            <details>
              <summary className="cursor-pointer text-sm text-[#5c5348]">Read the cloud as a list</summary>
              <ol className="mt-2 space-y-1 text-sm">
                {[...round.concepts]
                  .sort((a, b) => b.weight - a.weight || a.text.localeCompare(b.text))
                  .map((concept) => (
                    <li key={`${concept.text}-${concept.themeId}`}>
                      {concept.text} <span className="text-[#5c5348]">· {concept.weight}</span>
                    </li>
                  ))}
              </ol>
            </details>
          ) : null}

          {analysis && analysis.followUps.length > 0 ? (
            <div className="space-y-3 rounded-2xl border border-[#d9cdb8] bg-[#faf6ef] p-4">
              <h2 className="font-serif text-2xl">Ask this next</h2>
              <ul className="space-y-2">
                {analysis.followUps.map((prompt) => (
                  <li key={prompt}>
                    <button
                      type="button"
                      className="text-left text-sm leading-relaxed underline-offset-4 hover:underline"
                      onClick={() => setFollowUp(prompt)}
                    >
                      {prompt}
                    </button>
                  </li>
                ))}
              </ul>
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run("round", async () => {
                    await api(`/api/rooms/${code}/rounds`, {
                      json: { action: "open", prompt: followUp },
                      headers: auth,
                    });
                    setPinned(null);
                    setFollowUp("");
                    setView("cloud");
                  });
                }}
              >
                <Label htmlFor="next-prompt">Next question</Label>
                <Textarea
                  id="next-prompt"
                  value={followUp}
                  maxLength={280}
                  onChange={(event) => setFollowUp(event.target.value)}
                  placeholder="Or write your own."
                />
                <Button type="submit" disabled={busy !== null || followUp.trim().length === 0}>
                  Publish next round
                </Button>
              </form>
            </div>
          ) : null}
        </section>

        <Feed
          responses={responses}
          glow={glow}
          busy={busy !== null}
          onToggle={(response) =>
            run("hide", async () => {
              await api(`/api/rooms/${code}/responses/${response.id}`, {
                method: "PATCH",
                json: { hidden: !response.hidden },
                headers: auth,
              });
            })
          }
        />
      </div>

      <footer className="flex flex-wrap gap-2 border-t border-[#d9cdb8] pt-4">
        {data.room.isDemo ? (
          <>
            <Button variant="outline" onClick={() => setReplayOpen(true)}>
              Watch the sample fill in
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                run("restore", async () => {
                  await api(`/api/rooms/${code}/replay`, { json: { mode: "restore" }, headers: auth });
                })
              }
            >
              Restore the full sample
            </Button>
          </>
        ) : (
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            Delete this room
          </Button>
        )}
      </footer>

      {present ? (
        <Presenter
          prompt={round.prompt}
          count={visibleCount}
          view={view}
          setView={setView}
          onClose={() => setPresent(false)}
          concepts={round.concepts}
          themeIds={themeIds}
          legend={legend}
          analysis={analysis}
          responses={responses.filter((item) => !item.hidden)}
        />
      ) : null}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Invite the room</DialogTitle>
            <DialogDescription>
              Students join at this code. The host key is for a second screen, not for the projector.
            </DialogDescription>
          </DialogHeader>
          <p className="text-center font-mono text-4xl tracking-[0.35em]">{data.room.code}</p>
          <Image
            src={`/api/rooms/${code}/qr`}
            alt="QR code that joins this discussion"
            width={208}
            height={208}
            unoptimized
            className="mx-auto size-52"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(`${window.location.origin}/join/${code}`);
                toast.success("Join link copied.");
              }}
            >
              Copy join link
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(hostKey);
                toast.success("Host key copied.");
              }}
            >
              Copy host key
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={replayOpen} onOpenChange={setReplayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Replay the sample?</DialogTitle>
            <DialogDescription>
              This clears the sample room, including anyone who joined it, and plays the responses in again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplayOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="ochre"
              onClick={() => {
                setReplayOpen(false);
                setPinned(null);
                setView("cloud");
                void run("replay", async () => {
                  await api(`/api/rooms/${code}/replay`, { json: { mode: "play" }, headers: auth });
                });
              }}
            >
              Replay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Delete this room?</DialogTitle>
            <DialogDescription>
              Responses are removed from this server. Copy the summary first if you want to keep it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                run("delete", async () => {
                  await api(`/api/rooms/${code}`, { method: "DELETE", headers: auth });
                  setStoredKey(null);
                  router.push("/");
                })
              }
            >
              Delete the room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Feed({
  responses,
  glow,
  busy,
  onToggle,
}: {
  responses: HostResponse[];
  glow: string[];
  busy: boolean;
  onToggle: (response: HostResponse) => void;
}) {
  return (
    <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-auto">
      <h2 className="font-serif text-2xl">Voices</h2>
      <p className="mt-1 text-xs text-[#5c5348]">Names stay on this desk. Hidden lines leave the cloud and the next grouping.</p>
      {responses.length === 0 ? (
        <p className="mt-4 text-sm text-[#5c5348]">Waiting for the first response.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {responses.map((response) => (
            <li
              key={response.id}
              className={`rounded-2xl border border-[#d9cdb8] bg-[#faf6ef] p-3 ${
                response.hidden ? "opacity-50" : ""
              } ${glow.includes(response.id) ? "ring-2 ring-[#b8612d]" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-2 text-xs text-[#5c5348]">
                <span>{response.participant.label}</span>
                <span>{ago(response.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed">{response.text}</p>
              <Button variant="ghost" className="mt-1 px-0" disabled={busy} onClick={() => onToggle(response)}>
                {response.hidden ? "Restore" : "Hide"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function Presenter({
  prompt,
  count,
  view,
  setView,
  onClose,
  concepts,
  themeIds,
  legend,
  analysis,
  responses,
}: {
  prompt: string;
  count: number;
  view: View;
  setView: (view: View) => void;
  onClose: () => void;
  concepts: HostSnapshot["rounds"][number]["concepts"];
  themeIds: string[];
  legend: { id: string; label: string }[];
  analysis: HostSnapshot["analyses"][number] | null;
  responses: HostResponse[];
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#16130f] px-6 py-5 text-[#f3ecdf] sm:px-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-4xl">
          <p className="text-sm text-[#d7cbb8]">{count} responses</p>
          <h2 className="mt-1 font-serif text-3xl leading-tight sm:text-5xl">{prompt}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["cloud", "Cloud"],
              ["themes", "Themes"],
              ["tensions", "Tensions"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              variant={view === id ? "secondary" : "outline"}
              className={view === id ? "" : "border-[#5c5348] bg-transparent text-[#f3ecdf] hover:bg-white/10"}
              onClick={() => setView(id)}
            >
              {label}
            </Button>
          ))}
          <Button variant="outline" className="border-[#5c5348] bg-transparent text-[#f3ecdf] hover:bg-white/10" onClick={onClose}>
            Exit
          </Button>
        </div>
      </div>
      <p className="mt-2 hidden text-xs text-[#8a7d6d] sm:block">C cloud · T themes · S tensions · Esc exit</p>
      <div className="mt-4 min-h-0 flex-1 overflow-auto">
        {view === "cloud" ? (
          <WordCloud concepts={concepts} themeIds={themeIds} tone="ink" legend={legend} />
        ) : null}
        {view === "themes" ? (
          <ThemeBoard
            overview={analysis?.overview ?? "Group the room from the desk to bring the threads up here."}
            themes={analysis?.themes ?? []}
            responses={responses}
            tone="ink"
          />
        ) : null}
        {view === "tensions" ? (
          <TensionBoard
            tensions={analysis?.tensions ?? []}
            themes={analysis?.themes ?? []}
            responses={responses}
            tone="ink"
            grouped={Boolean(analysis)}
          />
        ) : null}
      </div>
    </div>
  );
}
