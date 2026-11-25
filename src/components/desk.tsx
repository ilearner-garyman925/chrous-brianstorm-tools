"use client";
import { ChorusIcon } from "@/components/chorus-icons";

import Image from "next/image";
import { SettingsButton, usePreferences } from "@/components/preferences";
import { MoreHorizontal, Maximize2, Play, UserPlus, RotateCcw, X, ChevronRight, PauseCircle, Copy, Trash2, Files, PlayCircle, Clock3, Check, Pause } from "lucide-react";
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
import { conceptForResponse } from "@/lib/concept-detail";
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
  const {t} = usePreferences();
  const router = useRouter();
  const storageKey = `chorus.host.${code}`;
  const hydrated = useHydrated();
  const [storedKey, setStoredKey] = useStoredValue(storageKey);
  const hostKey = code === DEMO_CODE ? DEMO_HOST_KEY : storedKey;
  const [pastedKey, setPastedKey] = useState("");
  const [pinned, setPinned] = useState<string | null>(null);
  const [view, setView] = useState<View>("cloud");
  const [cloudReset, setCloudReset] = useState(0);
  const [responseFocus,setResponseFocus] = useState<{key:string;roundId:string;sequence:number}|null>(null);
  const [present, setPresent] = useState(false);
  const [voicesHidden, setVoicesHidden] = useState(true);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const historyPanelRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const morePanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const button = historyOpen ? historyButtonRef.current : moreButtonRef.current;
    const panel = historyOpen ? historyPanelRef.current : morePanelRef.current;
    const dock = panel?.offsetParent;
    if ((!controlsOpen && !historyOpen) || !button || !panel || !(dock instanceof HTMLElement)) return;
    const position = () => {
      const anchor = button.getBoundingClientRect();
      const bounds = dock.getBoundingClientRect();
      const width = panel.offsetWidth;
      const center = anchor.left + anchor.width / 2;
      // Grow to the right of More; shift left only to avoid the viewport edge.
      const left = Math.max(12, Math.min(center - 30, bounds.right - width));
      panel.style.setProperty("--more-left", `${left - bounds.left}px`);
      panel.style.setProperty("--more-tail", `${Math.max(20, Math.min(width - 30, center - left - 10))}px`);
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(button);
    observer.observe(dock);
    observer.observe(panel);
    window.addEventListener("resize", position);
    return () => { observer.disconnect(); window.removeEventListener("resize", position); };
  }, [controlsOpen, historyOpen, view]);
  const [canvasExpanded, setCanvasExpanded] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [utilityPanel, setUtilityPanel] = useState<"list" | "next" | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [followUp, setFollowUp] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [glow, setGlow] = useState<string[]>([]);
  const seen = useRef(new Set<string>());
  const [animatedWords] = useState(() => new Set<string>());

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
    return () => {
      document.body.style.overflow = previous;
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
        <h1 className="font-sans text-4xl">This desk needs its key.</h1>
        <p className="text-sm leading-relaxed text-[#586380]">
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
        <h1 className="font-sans text-4xl">{poll.error || "The room is not available."}</h1>
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
    <div className={`desk-shell orbit-shell${canvasExpanded ? " canvas-expanded" : ""}`} data-view={view}>
      <header className="desk-header">
        <Brand light />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setInviteOpen(true)}>
            <UserPlus size={16} /> {t("Invite")}
          </Button>
          <Button onClick={() => setPresent(true)}><Play size={16} fill="currentColor" /> {t("Present")}</Button><SettingsButton/>
        </div>
      </header>

      <div className="desk-question">
        <h1>{round.prompt}</h1>
        <div className="orbit-meta teacher-status-bar">
          <span role="status" className={`teacher-response-status ${!isLatest ? "is-history" : round.status === "open" ? "is-open" : "is-paused"}`}>
            <span className="teacher-status-lamp" aria-hidden="true">{!isLatest ? <Clock3 size={18}/> : round.status === "open" ? null : <Pause size={13}/>}</span>
            {!isLatest ? t("Viewing past round", "正在查看過往回合") : round.status === "open" ? t("Responses open", "正在收集回應") : t("Responses paused", "已暫停收集回應")}
          </span>
          <span className="teacher-response-count" aria-live="polite"><ChorusIcon kind="responses" size={19}/><span>{visibleCount} {t("responses")}</span></span>
          {!isLatest && <button className="teacher-back-current" onClick={()=>{setPinned(null);setResponseFocus(null);}}>{t("Back to current", "返回目前回合")}</button>}
          {data.replay?.running ? <span>Playing {data.replay.cursor} of {data.replay.total}</span> : null}
        </div>
      </div>

      {visibleCount < 2 ? (
        <p className="text-sm text-[#586380]">{t("Grouping starts at two visible responses. One voice is not a pattern yet.")}</p>
      ) : null}
      {actionError ? <p className="text-sm text-[#9c3b3b]">{actionError}</p> : null}

      <div className={`desk-workspace${voicesHidden || canvasExpanded ? " voices-hidden" : ""}`}>
        <section className="min-w-0 space-y-4">
          <div className={view === "cloud" ? "discussion-canvas cloud-canvas" : "discussion-canvas"}>
            {view === "cloud" ? (
              <WordCloud
                key={`${round.id}:${cloudReset}`}
                concepts={round.concepts}
                themeIds={themeIds}
                tone="ink"
                legend={legend}
                playful
                orbit
                focusRequest={responseFocus?.roundId===round.id?responseFocus:null}
                onFocusHandled={()=>setResponseFocus(null)}
                animationHistory={animatedWords}
                animationScope={`${round.id}:${cloudReset}`}
                busy={busy !== null}
                onHide={(id) => run("hide", async () => {
                  await api(`/api/rooms/${code}/responses/${id}`, { method: "PATCH", json: { hidden: true }, headers: auth });
                })}
                showNames
                quotes={responses
                  .filter((response) => !response.hidden)
                  .map((response) => ({
                    id: response.id,
                    text: response.text,
                    label: response.participant.label,
                    participantId: response.participant.id,
                  }))}
                themes={analysis?.themes ?? []}
              />
            ) : null}
            {view === "themes" ? (
              <ThemeBoard
                overview={analysis?.overview ?? t("The threads appear after you group the room.")}
                themes={analysis?.themes ?? []}
                responses={responses}
                tone="ink"
              />
            ) : null}
            {view === "tensions" ? (
              <TensionBoard
                tensions={analysis?.tensions ?? []}
                themes={analysis?.themes ?? []}
                responses={responses.filter((item) => !item.hidden)}
                tone="ink"
                grouped={Boolean(analysis)}
              />
            ) : null}
          </div>
        </section>

        {!voicesHidden && !canvasExpanded ? <Feed
          responses={responses}
          conceptFor={response=>response.hidden?null:conceptForResponse(response,round.concepts,analysis?.themes??[])}
          onLocate={key=>{setView("cloud");setVoicesHidden(true);setResponseFocus(previous=>({key,roundId:round.id,sequence:(previous?.sequence??0)+1}));}}
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
        /> : null}
      </div>

      <div className="orbit-dock">
          <div className="canvas-toolbar">
          <Tabs
            value={view}
            onValueChange={(value) => {
              if (value === "cloud" || value === "themes" || value === "tensions") setView(value);
            }}
          >
            <TabsList>
              <TabsTrigger value="cloud"><ChorusIcon kind="cloud" size={17} /> {t("Cloud")}</TabsTrigger>
              <TabsTrigger value="themes"><ChorusIcon kind="themes" size={17} /> {t("Themes")}</TabsTrigger>
              <TabsTrigger value="tensions"><ChorusIcon kind="tensions" size={17} /> {t("Tensions")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="canvas-actions">
            <Button variant="outline" aria-expanded={!voicesHidden} disabled={canvasExpanded} onClick={() => setVoicesHidden(!voicesHidden)}><ChorusIcon kind="voices" size={17}/>{voicesHidden ? t("Voices") : t("Hide voices")}</Button>

        <Button className="orbit-primary-group"
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
          <ChorusIcon kind="group" size={17}/>{busy === "group" ? t("Grouping…") : t("Group")}
        </Button>
            {view === "cloud" && <Button className="orbit-dock-restore" variant="outline" onClick={() => setCloudReset(value => value + 1)}><RotateCcw size={17}/> {t("Restore")}</Button>}
            <Button ref={historyButtonRef} className="orbit-history-toggle" variant="outline" aria-expanded={historyOpen} aria-controls="orbit-history" onClick={()=>{setControlsOpen(false);setHistoryOpen(!historyOpen);}}><Clock3 size={17}/>{t("History", "歷史回合")}</Button>
            <Button ref={moreButtonRef} className="orbit-controls-toggle" variant="outline" aria-expanded={controlsOpen} aria-controls="orbit-controls" onClick={() => {setHistoryOpen(false);setControlsOpen(!controlsOpen);}}><MoreHorizontal size={17}/> {t("More")}</Button>
          </div>
          </div>
      <div ref={historyPanelRef} id="orbit-history" className={`desk-controls chorus-more-panel chorus-history-panel${historyOpen ? " controls-open" : ""}`} role="region" aria-label={t("History", "歷史回合")}
        onKeyDown={event=>{if(event.key==="Escape"){setHistoryOpen(false);historyButtonRef.current?.focus();}}}>
        <div className="chorus-more-content">
          <header className="chorus-more-heading"><h2>{t("History", "歷史回合")}</h2><button className="chorus-more-close" type="button" aria-label={t("Close", "關閉")} onClick={()=>{setHistoryOpen(false);historyButtonRef.current?.focus();}}><X size={19}/></button></header>
          <div className="history-rounds">{[...data.rounds].reverse().map(item=>{
            const count=data.responses.filter(response=>response.roundId===item.id&&!response.hidden).length;
            return <button type="button" key={item.id} className="history-round" aria-current={item.id===round.id?"true":undefined}
              onClick={()=>{setPinned(item.id===data.activeRoundId?null:item.id);setResponseFocus(null);setHistoryOpen(false);historyButtonRef.current?.focus();}}>
              <span><strong>{t("Round", "回合")} {item.index}{item.id===latest.id&&<em>{t("Current", "目前")}</em>}</strong>
              <span className="history-question">{item.prompt}</span><small>{count} {t("responses")}</small></span>
              {item.id===round.id?<Check size={18}/>:<ChevronRight size={18}/>}
            </button>;
          })}</div>
          <p className="history-help">{t("Select a round to view its discussion.", "選擇回合以查看當時的討論。")}</p>
        </div>
      </div>
      <div ref={morePanelRef} className={`desk-controls chorus-more-panel${controlsOpen ? " controls-open" : ""}`} id="orbit-controls" role="region" aria-label={t("More", "更多")}
        onKeyDown={event=>{if(event.key === "Escape") {setControlsOpen(false);document.querySelector<HTMLButtonElement>(".orbit-controls-toggle")?.focus();}}}>
        <div className="chorus-more-content">
        <header className="chorus-more-heading"><h2>{t("More", "更多")}</h2><button type="button" className="chorus-more-close" aria-label={t("Close", "關閉")} onClick={()=>{setControlsOpen(false);document.querySelector<HTMLButtonElement>(".orbit-controls-toggle")?.focus();}}><X size={19}/></button></header>
        <section className="chorus-more-section">
          <h3>{t("Discussion", "討論流程")}</h3>
          <button type="button" className="chorus-more-row chorus-more-featured" onClick={()=>{setControlsOpen(false);setUtilityPanel("next");}}><ChorusIcon kind="next"/><span><strong>{t("Next question", "下一題")}</strong><small>{t("Choose a suggestion or write your own.", "選擇建議問題，或自行輸入。")}</small></span><ChevronRight/></button>
          {isLatest ? <button type="button" className="chorus-more-row" disabled={busy !== null} onClick={()=>run("lock", async()=>{
            await api(`/api/rooms/${code}/rounds`, {json:{action:latest.status === "open" ? "lock" : "unlock"},headers:auth});
          })}>{latest.status === "open" ? <PauseCircle/> : <PlayCircle/>}<span><strong>{latest.status === "open" ? t("Pause responses", "暫停收集回應") : t("Resume responses", "恢復收集回應")}</strong><small>{latest.status === "open" ? t("Stop collecting until you reopen.", "暫停接收，稍後可隨時恢復。") : t("Let students respond again.", "讓學生繼續提交回應。")}</small></span><ChevronRight/></button>
          : <p className="chorus-more-note">{t(`This round is closed. The live round is Round ${latest.index}.`, `這回合已關閉，目前進行至回合 ${latest.index}。`)}</p>}
          <button type="button" className="chorus-more-row orbit-mobile-group" disabled={busy !== null || visibleCount < 2} onClick={()=>run("group",async()=>{
            await api(`/api/rooms/${code}/analyze`,{json:{roundId:round.id},headers:auth});setView("themes");setControlsOpen(false);
          })}><ChorusIcon kind="group"/><span><strong>{busy === "group" ? t("Grouping…") : analysis ? t("Group again") : t("Group the room")}</strong><small>{t("Find themes in the responses.", "整理回應中的共同主題。")}</small></span></button>
        </section>
        <section className="chorus-more-section">
          <h3>{t("Display", "顯示設定")}</h3>
          <button type="button" className="chorus-more-row" aria-pressed={canvasExpanded} onClick={()=>{setCanvasExpanded(!canvasExpanded);setControlsOpen(false);}}><Maximize2/><span><strong>{canvasExpanded ? t("Restore layout") : t("Expand canvas")}</strong><small>{t("Make more room for the discussion.", "為討論內容騰出更多空間。")}</small></span><ChevronRight/></button>
          <div className="chorus-more-row chorus-more-switch"><ChorusIcon kind="shared"/><label htmlFor="student-cloud"><strong>{t("Show cloud to students", "向學生顯示氣泡")}</strong><small>{t("Let students view the shared cloud.", "讓學生查看共享的氣泡圖。")}</small></label><Switch id="student-cloud" disabled={busy !== null} checked={data.room.showCloudToStudents} onCheckedChange={checked=>run("cloud",async()=>{
            await api(`/api/rooms/${code}`,{method:"PATCH",json:{showCloudToStudents:checked},headers:auth});
          })}/></div>
        </section>
        <section className="chorus-more-section">
          <h3>{t("Review & export", "整理與匯出")}</h3>
          <button type="button" className="chorus-more-row" onClick={()=>{setControlsOpen(false);setUtilityPanel("list");}}><ChorusIcon kind="responses"/><span><strong>{t("Concept list", "概念清單")}</strong><small>{t("Browse this round’s concepts.", "查看本回合的所有概念。")}</small></span><ChevronRight/></button>
          {analysis && <button type="button" className="chorus-more-row" onClick={async()=>{
            try {await navigator.clipboard.writeText(discussionMarkdown(data,round.id));toast.success(t("Summary copied.", "已複製討論摘要。"));setControlsOpen(false);}
            catch {toast.error(t("Could not copy. Please try again.", "未能複製，請再試一次。"));}
          }}><Files/><span><strong>{t("Copy discussion summary", "複製討論摘要")}</strong><small>{t("Copy this round as formatted text.", "以格式化文字複製本回合內容。")}</small></span><Copy/></button>}
        </section>
        {!data.room.isDemo && <section className="chorus-more-section chorus-more-danger"><h3>{t("Room management", "房間管理")}</h3><button type="button" className="chorus-more-row" onClick={()=>{setControlsOpen(false);setDeleteOpen(true);}}><Trash2/><span><strong>{t("Delete this room")}</strong><small>{t("Remove the room and its responses.", "刪除房間及其回應。")}</small></span><ChevronRight/></button></section>}
        </div>
      </div>
      </div>

      <Dialog open={utilityPanel !== null} onOpenChange={(open) => {if(!open)setUtilityPanel(null);}}>
        <DialogContent className="orbit-utility-panel">
          <DialogHeader>
            <DialogTitle>{utilityPanel === "list" ? t("Concept list", "概念清單") : t("Ask this next")}</DialogTitle>
            <DialogDescription>{utilityPanel === "list" ? t("All words in this round, ordered by weight.") : t("Choose a suggestion or write your own question for the next round.")}</DialogDescription>
          </DialogHeader>
          <div className="orbit-utility-body">
            {utilityPanel === "list" ? <ol className="orbit-word-list">
              {[...round.concepts].sort((a,b)=>b.weight-a.weight||a.text.localeCompare(b.text)).map(concept=><li key={`${concept.text}-${concept.themeId}`}><span>{concept.text}</span><span aria-label={`Weight ${concept.weight}`}>{concept.weight}</span></li>)}
              {round.concepts.length === 0 && <li>{t("Words will appear as responses arrive.")}</li>}
            </ol> : <>
              {!!analysis?.followUps.length && <ul className="orbit-question-suggestions">
                {analysis.followUps.map(prompt=><li key={prompt}><button type="button" aria-pressed={followUp===prompt} onClick={()=>setFollowUp(prompt)}>{prompt}</button></li>)}
              </ul>}
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
                    setUtilityPanel(null);
                    setView("cloud");
                  });
                }}
              >
                <Label htmlFor="next-prompt">{t("Next question")}</Label>
                <Textarea
                  id="next-prompt"
                  value={followUp}
                  maxLength={280}
                  onChange={(event) => setFollowUp(event.target.value)}
                  placeholder={t("Or write your own.")}
                />
                <Button type="submit" disabled={busy !== null || followUp.trim().length === 0}>
                  {t("Publish next round")}
                </Button>
              </form>
              {actionError && <p role="alert" className="orbit-utility-error">{actionError}</p>}
            </>}
          </div>
        </DialogContent>
      </Dialog>

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
            <DialogTitle className="font-sans text-2xl">{t("Invite the room")}</DialogTitle>
            <DialogDescription>
              {t("Students join at this code. The host key is for a second screen, not for the projector.")}
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
              {t("Copy join link")}
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(hostKey);
                toast.success("Host key copied.");
              }}
            >
              {t("Copy host key")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-sans text-2xl">{t("Delete this room?")}</DialogTitle>
            <DialogDescription>
              {t("Responses are removed from this server. Copy the summary first if you want to keep it.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {t("Keep it")}
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
              {t("Delete the room")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Feed({
  conceptFor,
  onLocate,
  responses,
  glow,
  busy,
  onToggle,
}: {
  conceptFor:(response:HostResponse)=>{text:string;themeId:string|null}|null;
  onLocate:(key:string)=>void;
  responses: HostResponse[];
  glow: string[];
  busy: boolean;
  onToggle: (response: HostResponse) => void;
}) {
  const {t} = usePreferences();
  return (
    <aside className="voices-panel">
      <h2 className="font-sans text-2xl">{t("Voices")}</h2>
      <p className="mt-1 text-xs text-[#586380]">{t("Names stay on this desk. Hidden lines leave the cloud and the next grouping.")}</p>
      {responses.length === 0 ? (
        <p className="mt-4 text-sm text-[#586380]">{t("Waiting for the first response.")}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {responses.map((response) => (
            <li
              key={response.id}
              className={`rounded-2xl border border-[#dbe1ef] bg-[#ffffff] p-3 ${
                response.hidden ? "opacity-50" : ""
              } ${glow.includes(response.id) ? "ring-2 ring-[#5138ed]" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-2 text-xs text-[#586380]">
                <span>{response.participant.label}</span>
                <span>{ago(response.createdAt)}</span>
              </div>
              <button type="button" className="voice-concept-link" disabled={!conceptFor(response)}
                title={conceptFor(response)?t("Open related bubble","查看對應氣泡"):t("No visible bubble is linked to this response yet.","此回應暫未連結到可見氣泡。")}
                onClick={()=>{const concept=conceptFor(response);if(concept)onLocate(`${concept.text}:${concept.themeId??""}`);}}>{response.text}</button>
              <Button variant="ghost" className="mt-1 px-0" disabled={busy} onClick={() => onToggle(response)}>
                {response.hidden ? t("Restore") : t("Hide")}
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
  const {t} = usePreferences();
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "Escape") {
        if (picked) setPicked(null);
        else onClose();
        return;
      }
      if (event.key === "c" || event.key === "C") {
        setPicked(null);
        setView("cloud");
      }
      if (event.key === "t" || event.key === "T") {
        setPicked(null);
        setView("themes");
      }
      if (event.key === "s" || event.key === "S") {
        setPicked(null);
        setView("tensions");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, picked, setView]);

  return (
    <div className="orbit-presenter fixed inset-0 z-40 flex flex-col bg-[#16130f] px-6 py-5 text-[#f5f7fc] sm:px-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-4xl">
          <p className="text-sm text-[#d7cbb8]">{count} {t("responses")}</p>
          <h2 className="mt-1 font-sans text-3xl leading-tight sm:text-5xl">{prompt}</h2>
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
              className={view === id ? "" : "border-[#586380] bg-transparent text-[#f5f7fc] hover:bg-white/10"}
              onClick={() => {
                setPicked(null);
                setView(id);
              }}
            >
              {t(label)}
            </Button>
          ))}
          <Button variant="outline" className="border-[#586380] bg-transparent text-[#f5f7fc] hover:bg-white/10" onClick={onClose}>
            {t("Exit")}
          </Button>
        </div>
      </div>
      <p className="mt-2 hidden text-xs text-[#8a7d6d] sm:block">
        {t("Click a bubble · C cloud · T themes · S tensions · Esc to close", "點選氣泡 · C 氣泡 · T 主題 · S 分歧 · Esc 關閉")}
      </p>
      <div className={`mt-4 min-h-0 flex-1 ${view === "cloud" ? "overflow-hidden" : "overflow-auto"}`}>
        {view === "cloud" ? (
          <WordCloud
            concepts={concepts}
            themeIds={themeIds}
            tone="ink"
            legend={legend}
            playful
            orbit
            quotes={responses}
            themes={analysis?.themes ?? []}
            pickedKey={picked}
            onPick={setPicked}
          />
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
