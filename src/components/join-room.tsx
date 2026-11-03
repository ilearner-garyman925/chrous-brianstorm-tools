"use client";

import { useCallback, useMemo, useState } from "react";
import { Brand } from "@/components/brand";
import { api } from "@/components/api";
import { useHydrated, useStoredValue } from "@/components/stored";
import { usePoll } from "@/components/use-poll";
import { WordCloud } from "@/components/word-cloud";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { StudentSnapshot } from "@/lib/types";

export function JoinRoom({ code }: { code: string }) {
  const storageKey = `chorus.seat.${code}`;
  const hydrated = useHydrated();
  const [token, setToken] = useStoredValue(storageKey);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [heard, setHeard] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [trackedRound, setTrackedRound] = useState<string | null>(null);
  const [freshQuestion, setFreshQuestion] = useState(false);

  const headers = useMemo(() => {
    const next: Record<string, string> = {};
    if (token) next["x-participant-token"] = token;
    return next;
  }, [token]);
  const onPollError = useCallback(
    (message: string) => {
      if (/seat is no longer valid/i.test(message)) setToken(null);
    },
    [setToken],
  );
  const poll = usePoll<StudentSnapshot>(hydrated ? `/api/rooms/${code}` : null, headers, onPollError);
  const data = poll.data;
  const roundId = data?.round?.id ?? null;
  if (roundId !== trackedRound) {
    setTrackedRound(roundId);
    setFreshQuestion(trackedRound !== null && roundId !== null);
    if (trackedRound) {
      setText("");
      setHeard(false);
    }
  }

  async function join(event: React.FormEvent) {
    event.preventDefault();
    setActionError(null);
    try {
      const seat = await api<{ token: string }>(`/api/rooms/${code}/join`, {
        json: { displayName: name },
      });
      localStorage.setItem(storageKey, seat.token);
      setToken(seat.token);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not join.");
    }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    setSending(true);
    setActionError(null);
    try {
      await api(`/api/rooms/${code}/responses`, {
        json: { text },
        headers: { "x-participant-token": token },
      });
      setText("");
      setHeard(true);
      window.setTimeout(() => setHeard(false), 2200);
      await poll.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not send.");
    } finally {
      setSending(false);
    }
  }

  if (!hydrated || (!data && !poll.error)) {
    return (
      <div className="grid min-h-screen place-items-center">
        <p className="font-serif text-2xl text-[#5c5348]">Finding the discussion…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-4">
        <Brand />
        <h1 className="font-serif text-4xl">No room with that code.</h1>
        <p className="text-[#5c5348]">Check the board and try the code again.</p>
      </div>
    );
  }

  const round = data.round;
  const mineNow = round ? data.myResponses.filter((item) => item.roundId === round.id) : [];
  const earlier = round ? data.myResponses.filter((item) => item.roundId !== round.id) : [];
  const capped = round ? mineNow.length >= data.room.maxPerPerson : false;
  const closed = round?.status === "locked";
  const themeIds = data.legend?.map((item) => item.id) ?? [];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-6 sm:py-10">
      <Brand />
      <div>
        <p className="text-sm text-[#5c5348]">{data.room.title}</p>
        <p className="mt-2 text-sm tracking-wide text-[#b8612d] uppercase">
          Round {round?.index ?? 1}
          {freshQuestion ? " · New question" : ""}
        </p>
        <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">{round?.prompt}</h1>
        <p className="mt-3 text-sm text-[#5c5348]" aria-live="polite">
          {data.responseCount} {data.responseCount === 1 ? "response" : "responses"} in the room
        </p>
      </div>

      {!data.joined ? (
        <form className="space-y-4 rounded-3xl border border-[#d9cdb8] bg-[#faf6ef] p-5" onSubmit={join}>
          <p className="text-sm leading-relaxed text-[#5c5348]">
            The projector never shows names. {data.room.askForNames ? "A name is optional, and only the teacher sees it." : "This room is unnamed."}
          </p>
          {data.room.askForNames ? (
            <div className="space-y-2">
              <Label htmlFor="name">Your name, if you want the teacher to know it</Label>
              <Input id="name" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} />
            </div>
          ) : null}
          {actionError ? <p className="text-sm text-[#9c3b3b]">{actionError}</p> : null}
          <Button type="submit" size="touch" variant="ochre">
            {data.room.askForNames && name.trim() ? `Join as ${name.trim()}` : "Join unnamed"}
          </Button>
        </form>
      ) : (
        <form className="space-y-3" onSubmit={send}>
          <Label htmlFor="response" className="text-base">
            Your response
          </Label>
          <Textarea
            id="response"
            value={text}
            maxLength={500}
            disabled={closed || capped || sending}
            placeholder={closed ? "This round is closed." : "A few sentences. Say the thing you'd actually say out loud."}
            onChange={(event) => {
              setText(event.target.value);
              setFreshQuestion(false);
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#5c5348]">
            <span>
              {mineNow.length} of {data.room.maxPerPerson} sent this round
              {heard ? " · Heard." : ""}
            </span>
            <span>{text.length}/500</span>
          </div>
          {actionError ? <p className="text-sm text-[#9c3b3b]">{actionError}</p> : null}
          <Button type="submit" size="touch" variant="ochre" disabled={closed || capped || sending || text.trim().length === 0}>
            {closed ? "This round is closed" : capped ? "That's your lot this round" : sending ? "Sending…" : "Send to the room"}
          </Button>
        </form>
      )}

      {mineNow.length > 0 ? (
        <section>
          <h2 className="font-serif text-2xl">You sent</h2>
          <ul className="mt-3 space-y-3">
            {mineNow.map((item) => (
              <li key={item.id} className="rounded-2xl border border-[#d9cdb8] bg-[#faf6ef] p-4 font-serif text-lg leading-snug">
                {item.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {earlier.length > 0 ? (
        <section>
          <h2 className="font-serif text-2xl">Earlier rounds</h2>
          <ul className="mt-3 space-y-3">
            {earlier.map((item) => (
              <li key={item.id} className="text-sm leading-relaxed text-[#5c5348]">
                <span className="block text-xs tracking-wide uppercase">Round {item.roundIndex}</span>
                {item.text}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.concepts ? (
        <section className="h-72">
          <h2 className="font-serif text-2xl">The room so far</h2>
          <WordCloud concepts={data.concepts} themeIds={themeIds} tone="paper" legend={data.legend ?? undefined} />
        </section>
      ) : null}
    </div>
  );
}
