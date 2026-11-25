"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Brand } from "@/components/brand";
import { api } from "@/components/api";
import { WordCloud } from "@/components/word-cloud";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Concept } from "@/lib/types";

const PREVIEW: Concept[] = [
  { text: "Draft", weight: 10, themeId: "feedback" },
  { text: "Feedback", weight: 9, themeId: "feedback" },
  { text: "Rewrite", weight: 6, themeId: "feedback" },
  { text: "Paid", weight: 8, themeId: "access" },
  { text: "Access", weight: 7, themeId: "access" },
  { text: "Voice", weight: 8, themeId: "voice" },
  { text: "Wording", weight: 5, themeId: "voice" },
  { text: "Brainstorm", weight: 7, themeId: "brainstorm" },
  { text: "Stuck", weight: 5, themeId: "brainstorm" },
  { text: "Habit", weight: 6, themeId: "dependency" },
  { text: "Laptop shut", weight: 4, themeId: "dependency" },
  { text: "Sources", weight: 7, themeId: "literacy" },
  { text: "Check", weight: 6, themeId: "literacy" },
  { text: "Prompt", weight: 4, themeId: "literacy" },
  { text: "Office hours", weight: 3, themeId: "aside" },
  { text: "Projector", weight: 3, themeId: "aside" },
];

const THEME_IDS = ["feedback", "access", "voice", "brainstorm", "dependency", "literacy", "aside"];

export function HomeScreen() {
  const router = useRouter();
  const [title, setTitle] = useState("Wednesday seminar");
  const [prompt, setPrompt] = useState("What should we change about how we use AI tools in this class?");
  const [showCloud, setShowCloud] = useState(false);
  const [askForNames, setAskForNames] = useState(true);
  const [maxPerPerson, setMaxPerPerson] = useState(3);
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      const room = await api<{ code: string; hostKey: string }>("/api/rooms", {
        json: { title, prompt, showCloudToStudents: showCloud, askForNames, maxPerPerson },
      });
      localStorage.setItem(`chorus.host.${room.code}`, room.hostKey);
      router.push(`/host/${room.code}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The room could not be opened.");
      setCreating(false);
    }
  }

  function join(event: React.FormEvent) {
    event.preventDefault();
    const next = code.trim().toUpperCase();
    if (next.length < 4) {
      toast.error("Room codes are four characters.");
      return;
    }
    router.push(`/join/${next}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Brand />
        <Button
          variant="outline"
          size="touch"
          onClick={() => router.push("/host/DEMO")}
        >
          Open the sample
        </Button>
      </header>

      <section className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className="text-sm tracking-wide text-[#586380] uppercase">For a live room</p>
          <h1 className="mt-3 max-w-xl font-sans text-5xl leading-[1.05] text-[#182044] sm:text-6xl">
            See the shape of the discussion.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-[#354361]">
            Students answer in their own words. You watch the room fill, then group it into themes,
            a cloud colored by meaning, the tensions, and a next question worth asking.
          </p>
        </div>
        <div className="h-80 rounded-3xl border border-[#dbe1ef] bg-[#ffffff] p-4">
          <WordCloud concepts={PREVIEW} themeIds={THEME_IDS} tone="paper" playful />
          <p className="text-center text-xs text-[#586380]">Sample room · how this class should use AI</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["1", "Publish a prompt", "One question on the table. Students join with a short code. No accounts."],
          ["2", "Let them write", "A few sentences, not a single sticker-word. Shy students can stay unnamed."],
          ["3", "Group the room", "Themes, a cloud, and the disagreement hiding under the popular answer."],
        ].map(([step, heading, body]) => (
          <div key={step} className="rounded-2xl border border-[#dbe1ef] bg-[#ffffff] p-5">
            <p className="font-sans text-3xl text-[#5138ed]">{step}</p>
            <h2 className="mt-2 font-sans text-2xl">{heading}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#586380]">{body}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="font-sans text-3xl">Host a discussion</CardTitle>
            <CardDescription>
              Responses stay on this server until you delete the room. Names, if shared, appear only on your desk — never on the projector.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={create}>
              <div className="space-y-2">
                <Label htmlFor="title">Session</Label>
                <Input id="title" value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prompt">Opening question</Label>
                <Textarea
                  id="prompt"
                  value={prompt}
                  maxLength={280}
                  onChange={(event) => setPrompt(event.target.value)}
                  required
                />
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Responses per person, each round</legend>
                <div className="flex gap-2">
                  {[1, 3, 8].map((count) => (
                    <Button
                      key={count}
                      type="button"
                      variant={maxPerPerson === count ? "default" : "outline"}
                      aria-pressed={maxPerPerson === count}
                      onClick={() => setMaxPerPerson(count)}
                    >
                      {count}
                    </Button>
                  ))}
                </div>
              </fieldset>
              <div className="flex items-start gap-3">
                <Switch id="names" checked={askForNames} onCheckedChange={setAskForNames} />
                <Label htmlFor="names" className="items-start font-normal">
                  Ask for a name. It stays on your desk, and staying unnamed is still the easy path.
                </Label>
              </div>
              <div className="flex items-start gap-3">
                <Switch id="cloud" checked={showCloud} onCheckedChange={setShowCloud} />
                <Label htmlFor="cloud" className="items-start font-normal">
                  Let students see the live cloud. Leave this off if early answers would anchor the room.
                </Label>
              </div>
              <Button type="submit" size="touch" variant="ochre" disabled={creating}>
                {creating ? "Opening the room…" : "Open the room"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-sans text-3xl">Join a room</CardTitle>
            <CardDescription>The code is on the board, or in the link your teacher sent.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={join}>
              <div className="space-y-2">
                <Label htmlFor="code">Room code</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  maxLength={6}
                  autoCapitalize="characters"
                  autoComplete="off"
                  placeholder="DEMO"
                  className="font-mono text-lg tracking-[0.3em]"
                />
              </div>
              <Button type="submit" size="touch">
                Join
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
