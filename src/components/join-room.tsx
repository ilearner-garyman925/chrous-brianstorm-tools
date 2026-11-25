"use client";
import { ChorusIcon } from "@/components/chorus-icons";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, MessageCircle, Clock3 } from "lucide-react";
import { SettingsButton, usePreferences } from "@/components/preferences";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Brand } from "@/components/brand";
import { api } from "@/components/api";
import { useHydrated, useStoredValue } from "@/components/stored";
import { usePoll } from "@/components/use-poll";
import { OrbitCloud } from "@/components/orbit-cloud";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { StudentSnapshot } from "@/lib/types";

export function JoinRoom({ code }: { code: string }) {
  const {t} = usePreferences();
  const [responsesOpen,setResponsesOpen] = useState(false);
  const responsesTrigger=useRef<HTMLButtonElement>(null);
  const storageKey = `chorus.seat.${code}`;
  const hydrated = useHydrated();
  const [token, setToken] = useStoredValue(storageKey);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [heard, setHeard] = useState(false);
  const [sentBubble, setSentBubble] = useState<{id:number; text:string; round:string | null} | null>(null);
  const bubbleSequence = useRef(0);
  useEffect(() => {
    if (!sentBubble) return;
    const timer = window.setTimeout(() => { setSentBubble(null); setHeard(false); }, 3400);
    return () => window.clearTimeout(timer);
  }, [sentBubble]);
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
    if (!token || sending || !text.trim()) return;
    const submittedText = text.trim();
    const submittedRound = roundId;
    setSending(true);
    setActionError(null);
    try {
      await api(`/api/rooms/${code}/responses`, {
        json: { text: submittedText },
        headers: { "x-participant-token": token },
      });
      setText("");
      setHeard(true);
      setSentBubble({id: ++bubbleSequence.current, text: submittedText, round: submittedRound});
      await poll.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not send.");
    } finally {
      setSending(false);
    }
  }

  if (!hydrated || (!data && !poll.error)) {
    return (
      <div className="orbit-student orbit-student-loading">
        <p className="font-sans text-2xl text-[#586380]">{t("Finding the discussion…","正在尋找討論室…")}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="orbit-student orbit-student-loading">
        <header className="student-header"><Brand light /><SettingsButton /></header>
        <h1 className="font-sans text-4xl">{t("No room with that code.","找不到此討論室。")}</h1>
        <p className="text-[#586380]">{t("Check the board and try the code again.","請核對老師提供的代碼，再試一次。")}</p>
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
    <div className={`orbit-student${data.joined ? " student-discussion" : ""}`}>
      <header className="student-header"><Brand light /><div className="student-header-actions">
        <button ref={responsesTrigger} className="student-responses-trigger" aria-haspopup="dialog" onClick={()=>setResponsesOpen(true)}><ChorusIcon kind="responses" size={18}/><span>{t("My responses","我的回應")}</span><span className="student-response-count">{data.myResponses.length}</span></button><SettingsButton />
      </div></header>
      <div className="student-question">
        <p className="text-sm text-[#586380]">{data.room.title}</p>
        <h1 className="student-prompt">{round?.prompt}</h1>
        <div className="student-meta">
          <span>{t("Round","回合")} {round?.index ?? 1}{freshQuestion ? t(" · New question"," · 新問題") : ""}</span>
          <span aria-live="polite">{t(`${data.responseCount} responses in the room`, `討論室共有 ${data.responseCount} 則回應`)}</span>
        </div>
      </div>

      <div className={data.joined ? "student-workspace" : "student-join-form"}>
      {!data.joined ? (
        <form className="student-card space-y-4" onSubmit={join}>
          <h2 className="student-card-title">{t("Your voice belongs here.","讓大家聽見你的想法。")}</h2>
          <p className="student-privacy">{data.room.askForNames ? t("Your name is optional. Only your teacher can see it.","姓名可選填，只有老師能看見。") : t("Join without a name.","你可以匿名加入。")} {t("Names never appear on the shared screen.","共用畫面不會顯示姓名。")}</p>
          {data.room.askForNames ? (
            <div className="space-y-2">
              <Label htmlFor="name">{t("Name (optional)","姓名（選填）")}</Label>
              <Input autoComplete="nickname" placeholder={t("Leave blank to join unnamed","留空即可匿名加入")} id="name" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} />
            </div>
          ) : null}
          {actionError ? <p role="alert" className="text-sm text-[#9c3b3b]">{actionError}</p> : null}
          <Button type="submit" size="touch" variant="ochre">
            {data.room.askForNames && name.trim() ? t(`Join as ${name.trim()}`,`以 ${name.trim()} 加入`) : t("Join unnamed","匿名加入")}
          </Button>
        </form>
      ) : (
        <form className="student-card space-y-3" onSubmit={send}>
          <Label htmlFor="response" className="student-card-title">
            {t("Your response","你的回應")}
          </Label>
          <div className="student-response-field">
          <Textarea
            id="response"
            value={text}
            maxLength={500}
            disabled={closed || capped || sending}
            placeholder={closed ? t("Responses paused", "已暫停收集回應") : t("What do you think? A few sentences is enough.","你有什麼想法？用幾句話分享便可以。")}
            onChange={(event) => {
              setText(event.target.value);
              setFreshQuestion(false);
            }}
          />
          {sentBubble && sentBubble.round === roundId && <div key={sentBubble.id} className="student-sent-bubble" aria-hidden="true">
            <span>{Array.from(sentBubble.text).slice(0, 60).join("")}{Array.from(sentBubble.text).length > 60 ? "…" : ""}</span>
          </div>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#586380]">
            <span role="status" aria-live="polite">
              {t(`${mineNow.length} of ${data.room.maxPerPerson} sent this round`,`本回合已送出 ${mineNow.length}／${data.room.maxPerPerson} 則`)}
              {heard ? t(" · Added to the discussion!"," · 已加入討論！") : ""}
            </span>
            <span>{text.length}/500</span>
          </div>
          {actionError ? <p role="alert" className="text-sm text-[#9c3b3b]">{actionError}</p> : null}
          <Button type="submit" size="touch" variant="ochre" disabled={closed || capped || sending || text.trim().length === 0}>
            {closed ? t("Responses paused", "已暫停收集回應") : capped ? t("That's your lot this round","已達本回合回應上限") : sending ? t("Sending…","送出中…") : t("Send to the room","送出回應")}
          </Button>
        </form>
      )}

      {data.joined && <section className="student-cloud student-shared-panel" aria-labelledby="shared-cloud-title">
        {data.concepts !== null && data.room.showCloudToStudents ?
          <StudentSharedCloud key={roundId} concepts={data.concepts} themeIds={themeIds} legend={data.legend} roundId={roundId} /> :
          <><h2 id="shared-cloud-title" aria-live="polite">{t("Waiting for teacher", "等待老師分享")}</h2>
          <div className="student-cloud-state" role="status">
            <div className="student-wait-icon" aria-hidden="true"><MessageCircle/><Clock3/></div>
            <h3>{t("Waiting for your teacher to share…", "等待老師分享討論氣泡…")}</h3>
            <p>{closed ? t("Your teacher will share the cloud here.", "老師分享後，氣泡圖便會在這裡顯示。") : capped ? t("Your responses have been sent. The shared cloud will appear here.", "你的回應已送出，共享氣泡將在這裡顯示。") : t("You can keep writing while you wait.", "等待期間，你可以繼續填寫回應。")}</p>
          </div></>}
      </section>}
      </div>

      <Dialog open={responsesOpen} onOpenChange={setResponsesOpen}>
        <DialogContent edge className="student-history-panel" showCloseButton={false} finalFocus={responsesTrigger}>
          <header><DialogTitle>{t("My responses","我的回應")} <span>{data.myResponses.length}</span></DialogTitle><button className="settings-close" aria-label={t("Close","關閉")} onClick={()=>setResponsesOpen(false)}><X size={22}/></button></header>
          <DialogDescription>{t("Your submitted responses in this discussion.","你在這個討論室已送出的回應。")}</DialogDescription>
          <div className="student-history-scroll">
            <section><h3>{t("This round","本回合")} · {round?.index ?? 1}</h3>
              {mineNow.length ? <ol>{mineNow.map(item=><li key={item.id}>{item.text}</li>)}</ol> : <p className="student-history-empty">{t("No responses yet. Share your first thought when you are ready.","尚未送出回應。準備好後，分享你的第一個想法。")}</p>}
            </section>
            {earlier.length>0&&<section><h3>{t("Earlier rounds","過往回合")}</h3><ol>{earlier.map(item=><li key={item.id}><small>{t("Round","回合")} {item.roundIndex}</small>{item.text}</li>)}</ol></section>}
          </div>
        </DialogContent>
      </Dialog>


    </div>
  );
}

function StudentSharedCloud({concepts,themeIds,legend,roundId}: {
  concepts: NonNullable<StudentSnapshot["concepts"]>; themeIds:string[];
  legend:StudentSnapshot["legend"]; roundId:string|null;
}) {
  const {t}=usePreferences();
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    const timer=window.setTimeout(()=>setReady(true),window.matchMedia("(prefers-reduced-motion: reduce)").matches?100:900);
    return ()=>window.clearTimeout(timer);
  },[]);
  return <>
    <h2 id="shared-cloud-title" aria-live="polite">{ready ? t("Viewing shared cloud", "正在查看共享氣泡") : t("Loading shared cloud…", "正在載入共享氣泡…")}</h2>
    <div className="student-cloud-stage" aria-busy={!ready}>
    {!ready && <div className="student-cloud-state student-cloud-loading" role="status">
      <div className="student-loading-bubbles" aria-hidden="true"><MessageCircle/><MessageCircle/><MessageCircle/></div>
      <h3>{t("Loading the shared cloud…", "正在載入討論氣泡…")}</h3>
    </div>}
    <div className="student-cloud-canvas" style={{visibility:ready?"visible":"hidden"}} aria-hidden={!ready} inert={!ready}>
      <OrbitCloud concepts={concepts} themeIds={themeIds}
        themes={(legend ?? []).map(theme=>({...theme,summary:"",responseIds:[]}))}
        readOnly animationScope={roundId ?? ""}/>
    </div>
  </div></>;
}
