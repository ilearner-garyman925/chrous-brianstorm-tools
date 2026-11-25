"use client";
import { createContext, useContext, useEffect, useState, useRef, useSyncExternalStore, type ReactNode } from "react";
import { Settings, Moon, Sun, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { defaultPreferences, fontScales, parsePreferences, type Preferences } from "@/lib/preferences";
const key = "chorus.preferences.v1";
type PreferenceContext = { preferences: Preferences; update: (patch: Partial<Preferences>) => void; t: (en: string, zh?: string) => string; fontScale: number };
const Context = createContext<PreferenceContext>({preferences:defaultPreferences,update:()=>{},t:en=>en,fontScale:1});
let snapshot = defaultPreferences;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
function getSnapshot() {
  if(!loaded) { loaded=true; try { snapshot=parsePreferences(localStorage.getItem(key)); } catch { /* Session-only preferences remain available. */ } }
  return snapshot;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const sync = (event: StorageEvent) => { if(event.key === key || event.key === null) { snapshot=parsePreferences(event.newValue); emit(); } };
  window.addEventListener("storage",sync);
  return () => {listeners.delete(listener);window.removeEventListener("storage",sync);};
}
function update(patch: Partial<Preferences>) {
  snapshot={...getSnapshot(),...patch};
  try { localStorage.setItem(key,JSON.stringify(snapshot)); } catch { /* Keep settings usable for this session. */ }
  emit();
}
export function PreferencesProvider({children}: {children: ReactNode}) {
  const preferences=useSyncExternalStore(subscribe,getSnapshot,()=>defaultPreferences);
  useEffect(() => {
    document.documentElement.dataset.appearance = preferences.theme;
    document.documentElement.dataset.fontSize = preferences.fontSize;
    document.documentElement.lang = preferences.language;
    document.documentElement.style.setProperty("--reading-scale", String(fontScales[preferences.fontSize]));
  }, [preferences]);
  const t = (en: string, zh?: string) => preferences.language === "zh-Hant" ? (zh ?? translations[en] ?? en) : en;
  return <Context.Provider value={{preferences, update, t, fontScale:fontScales[preferences.bubbleFontSize]}}>{children}</Context.Provider>;
}
export const usePreferences = () => useContext(Context);
export function TextSizeButton() {
  const {preferences,update,t}=usePreferences();
  const level=preferences.bubbleFontSize==="xlarge"?2:preferences.bubbleFontSize==="large"?1:0;
  const sizes=["standard","large","xlarge"] as const;
  const names=[t("Standard","正常"),t("Large","大"),t("Largest","最大")];
  const label=t(`Bubble text size: ${names[level]}`,`氣泡字體大小：${names[level]}`);
  return <div className="orbit-text-size" role="group" aria-label={t("Bubble text size","氣泡字體大小")} data-level={level}>
    <button type="button" className="orbit-text-size-step" aria-label={t("Decrease bubble text size","縮小氣泡字體")} disabled={level===0} onClick={()=>update({bubbleFontSize:sizes[Math.max(0,level-1)]})}>−</button>
    <span className="orbit-text-size-current" role="status" aria-label={label} title={label}>
    <span aria-hidden="true" className="orbit-text-size-letter">A</span>
    <span aria-hidden="true" className="orbit-text-size-levels">{sizes.map((size,i)=><i key={size} className={i<=level?"is-active":""}/>)}</span>
    </span>
    <button type="button" className="orbit-text-size-step" aria-label={t("Increase bubble text size","放大氣泡字體")} disabled={level===2} onClick={()=>update({bubbleFontSize:sizes[Math.min(2,level+1)]})}>+</button>
  </div>;
}
export function SettingsButton() {
  const {preferences, update, t} = usePreferences();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <>
    <button ref={trigger} type="button" className="settings-trigger" aria-label={t("Settings", "設定")} title={t("Settings", "設定")} aria-haspopup="dialog" onClick={() => setOpen(true)}><Settings size={20}/></button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent finalFocus={trigger} className="settings-popup" showCloseButton={false}>
        <header><DialogTitle>{t("Settings", "設定")}</DialogTitle><button className="settings-close" aria-label={t("Close", "關閉")} onClick={() => setOpen(false)}><X size={22}/></button></header>
        <DialogDescription className="sr-only">{t("Personalize this device’s display. Changes apply immediately.", "調整這部裝置的顯示偏好，變更即時套用。")}</DialogDescription>
        <div className="settings-section"><label htmlFor="settings-language">{t("Interface language", "介面語言")}</label><select id="settings-language" value={preferences.language} onChange={e => update({language:e.target.value as Preferences["language"]})}><option value="zh-Hant">繁體中文</option><option value="en">English</option></select></div>
        <fieldset className="settings-section"><legend>{t("Text size", "字體大小")}</legend><div className="settings-segments">{(["standard", "large", "xlarge"] as const).map((size,i)=><label key={size}><input type="radio" name="font-size" checked={preferences.fontSize===size} onChange={()=>update({fontSize:size})}/><span>{[t("Standard","正常"),t("Large","大"),t("Largest","最大")][i]}</span></label>)}</div><div className="settings-preview"><small>{t("Preview","預覽")}</small><p>{t("A space for every voice.","讓每個想法都被看見")}</p></div></fieldset>
        <fieldset className="settings-section"><legend>{t("Appearance","外觀")}</legend><div className="settings-modes">{(["dark","light"] as const).map(mode=><label key={mode}><input type="radio" name="appearance" checked={preferences.theme===mode} onChange={()=>update({theme:mode})}/><span>{mode==='dark'?<Moon size={22}/>:<Sun size={22}/>} {mode==='dark'?t("Dark","深色"):t("Light","淺色")}{preferences.theme===mode&&<Check size={17}/>}</span></label>)}</div></fieldset>
        <footer><span>{t("Changes apply immediately","變更即時套用")}</span><button className="settings-done" onClick={()=>setOpen(false)}>{t("Done","完成")}</button></footer>
      </DialogContent>
    </Dialog>
  </>;
}
const translations: Record<string,string> = {
"Invite":"邀請", "Present":"投影", "Cloud":"氣泡", "Themes":"主題", "Tensions":"分歧", "Voices":"學生回應", "Hide voices":"收起回應", "Group":"整合", "Grouping…":"整合中…", "Restore":"重設", "More":"更多", "Collecting":"收集中", "Closed":"已關閉", "Round":"回合", "responses":"則回應", "Word list":"概念清單", "Ask this next":"延伸提問", "Delete this room":"刪除討論室", "Reading the room…":"分析中…", "Group again":"重新整合", "Group the room":"整合回應", "Restore layout":"還原版面", "Expand canvas":"展開畫布", "Close this round":"結束此回合", "Reopen this round":"重開此回合", "Students can see the cloud":"學生可查看氣泡", "Copy summary":"複製摘要", "Next question":"下一個問題", "Publish next round":"發布下一回合", "Invite the room":"邀請學生", "Copy join link":"複製加入連結", "Copy host key":"複製老師密鑰", "Delete this room?":"刪除這個討論室？", "Keep it":"保留", "Delete the room":"刪除討論室", "Hide":"隱藏", "Close":"關閉", "Near":"近", "Deep":"遠", "Depth":"深度", "Exit":"離開", "Waiting for the first response.":"等待第一則回應。", "Or write your own.":"或自行輸入問題。", "All words in this round, ordered by weight.":"此回合的概念，按人數排列。", "Choose a suggestion or write your own question for the next round.":"選取建議，或自行輸入下一回合的問題。", "Words will appear as responses arrive.":"收到回應後，概念便會出現。", "Names stay on this desk. Hidden lines leave the cloud and the next grouping.":"姓名只在老師畫面顯示；隱藏的回應不會出現在氣泡或下次整合中。", "The threads appear after you group the room.":"整合回應後將顯示主題。", "Group the room to see the threads.":"整合回應以查看主題。", "Students join at this code. The host key is for a second screen, not for the projector.":"學生可使用此代碼加入。老師密鑰供另一部裝置管理，請勿投影給學生。", "Responses are removed from this server. Copy the summary first if you want to keep it.":"回應將從伺服器移除。如需保留，請先複製摘要。", "Grouping starts at two visible responses. One voice is not a pattern yet.":"收到至少兩則可見回應後，即可整合主題。"
};
