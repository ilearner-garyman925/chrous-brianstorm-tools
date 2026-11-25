"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePreferences } from "@/components/preferences";
import { ChorusIcon } from "@/components/chorus-icons";
import { colorForTheme } from "@/lib/colors";
import type { HostResponse, Tension, Theme } from "@/lib/types";

export function TensionBoard({ tensions, themes, responses, tone, grouped }: {
  tensions: Tension[]; themes: Theme[]; responses: HostResponse[]; tone: "paper" | "ink"; grouped: boolean;
}) {
  const { t } = usePreferences();
  const [picked, setPicked] = useState<string | null>(null);
  const panelId = useId();
  const workspaceRef = useRef<HTMLDivElement>(null);
  const selected = tensions.find(item => item.id === picked) ?? tensions[0];
  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const dock = workspace.closest(".orbit-shell")?.querySelector(".orbit-dock");
    const measure = () => workspace.style.setProperty("--themes-height", `${Math.max(180, (dock?.getBoundingClientRect().top ?? window.innerHeight) - workspace.getBoundingClientRect().top - 28)}px`);
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    if (dock) observer.observe(dock);
    measure();
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [tensions.length, grouped]);
  if (!grouped || !selected) return <p className="tensions-empty">{!grouped
    ? t("Group the room first. A tension is a disagreement, not just two topics sitting side by side.", "請先整合回應。分歧代表不同立場，而不只是兩個不同話題。")
    : t("No split has been named yet. Try a follow-up question.", "暫時未發現明顯分歧，可以透過延伸提問了解不同立場。")}</p>;
  return <div className="themes-board tensions-board" data-tone={tone}>
    <div className="themes-workspace" ref={workspaceRef}>
      <nav className="themes-navigation tensions-navigation" aria-label={t("Tensions", "分歧")}>
        <h2>{t("Tensions", "分歧")}</h2>
        <div className="themes-themeList">
          {tensions.map(item => <button type="button" key={item.id} className="themes-themeButton tensions-choice" aria-pressed={item.id === selected.id} aria-controls={panelId} onClick={() => setPicked(item.id)}>
            <ChorusIcon kind="tensions" />
            <span><strong>{item.label}</strong><small>{item.id === "tn_themes" ? t("Topic difference", "主題差異") : t("Different positions", "不同立場")}</small></span>
          </button>)}
        </div>
        <p className="tensions-caution">{t("Different topics do not always mean opposing views.", "不同話題不一定代表對立的觀點。")}</p>
      </nav>
      <TensionDetail key={selected.id} tension={selected} responses={responses} themes={themes} tone={tone} panelId={panelId} />
    </div>
  </div>;
}

function TensionDetail({ tension, responses, themes, tone, panelId }: {
  tension: Tension; responses: HostResponse[]; themes: Theme[]; tone: "paper" | "ink"; panelId: string;
}) {
  const { t } = usePreferences();
  const [picked, setPicked] = useState<string | null>(null);
  const [showRelated, setShowRelated] = useState(false);
  const [plotPage, setPlotPage] = useState(0);
  const byId = new Map(responses.filter(response => !response.hidden).map(response => [response.id, response]));
  const seen = new Set<string>();
  const placements = tension.placements.filter(item => {
    if (!byId.has(item.responseId) || seen.has(item.responseId) || !Number.isFinite(item.position)) return false;
    seen.add(item.responseId); return true;
  });
  const selected = placements.find(item => item.responseId === picked) ?? placements[0];
  const quote = selected && byId.get(selected.responseId);
  const themeIds = themes.map(theme => theme.id);
  const themeOf = (id: string) => themes.find(theme => theme.responseIds.includes(id));
  const usedThemes = themes.filter(theme => placements.some(item => themeOf(item.responseId)?.id === theme.id));
  const hasUnassigned = placements.some(item => !themeOf(item.responseId));
  // Stagger nearby markers vertically without changing their horizontal positions.
  const lanes: number[][] = [];
  const markers = placements.map(item => {
    const position = Math.max(0, Math.min(1, item.position));
    let lane = lanes.findIndex(values => values.every(value => Math.abs(value - position) >= .075));
    if (lane < 0) { lane = lanes.length; lanes.push([]); }
    lanes[lane].push(position);
    return { ...item, position, lane };
  });
  const pageCount = Math.max(1, Math.ceil(lanes.length / 2));
  const currentPage = Math.min(plotPage, pageCount - 1);
  const visibleMarkers = markers.filter(item => Math.floor(item.lane / 2) === currentPage);
  const changePage = (page: number) => {
    setPlotPage(page);
    setPicked(markers.find(item => Math.floor(item.lane / 2) === page)?.responseId ?? null);
  };
  const selectedTheme = quote && themeOf(quote.id);
  return <section className="themes-detail tensions-detail" id={panelId} aria-labelledby={`${panelId}-title`}>
    <header><h2 id={`${panelId}-title`}>{tension.label}</h2><p>{tension.summary}</p></header>
    {tension.id === "tn_themes" && <p className="tensions-note">{t("This compares topic wording, not opposing positions.", "這裡比較主題用字差異，並不代表立場對立。")}</p>}
    <div className="tensions-spectrum-scroll">
      <div className="tensions-spectrum">
        <div className="tensions-ends"><span>{tension.leftLabel}</span><span>{tension.rightLabel}</span></div>
        <div className="tensions-plot" style={{ height: 78 }}>
          <div className="tensions-axis" aria-hidden="true" />
          {visibleMarkers.map(item => <button key={item.responseId} type="button" className="tensions-marker"
            style={{ left: `${5 + item.position * 90}%`, top: 8 + (item.lane % 2) * 34, color: colorForTheme(themeOf(item.responseId)?.id ?? null, themeIds, tone) }}
            aria-label={byId.get(item.responseId)!.text} aria-pressed={selected?.responseId === item.responseId}
            aria-controls={`${panelId}-quote`} onClick={() => setPicked(item.responseId)}><span /></button>)}
        </div>
      </div>
    </div>
    {pageCount > 1 && <div className="tensions-pagination" aria-label={t("Response groups", "回應分組")}>
      <button type="button" disabled={currentPage === 0} onClick={() => changePage(currentPage - 1)}>{t("Previous group", "上一組")}</button>
      <span aria-live="polite">{t(`Group ${currentPage + 1} of ${pageCount}`, `第 ${currentPage + 1} / ${pageCount} 組`)} · {visibleMarkers.length} {t("responses", "則回應")}</span>
      <button type="button" disabled={currentPage === pageCount - 1} onClick={() => changePage(currentPage + 1)}>{t("Next group", "下一組")}</button>
    </div>}
    <div className="tensions-legend">
      <span>{t("Each dot = one response · Colour = theme", "每個圓點代表一則回應・顏色代表主題")}</span>
      {usedThemes.map(theme => <span key={theme.id}><i style={{ background: colorForTheme(theme.id, themeIds, tone) }} />{theme.label}</span>)}
      {hasUnassigned && <span><i style={{ background: colorForTheme(null, themeIds, tone) }} />{t("Other responses", "其他回應")}</span>}
    </div>
    <div className="tensions-evidence" id={`${panelId}-quote`} aria-live="polite">
      <div className="tensions-evidence-heading"><h3>{t("Selected response", "選中的回應")}</h3>{selectedTheme && <span className="themes-badge">{selectedTheme.label}</span>}</div>
      {quote ? <blockquote><ChorusIcon kind="tensions" /><p>{quote.text}</p></blockquote> : <p>{t("No visible responses in this comparison.", "這項比較暫無可顯示的回應。")}</p>}
    </div>
    <p className="tensions-help">{t("Select a dot to read its original wording.", "選取圓點，即可閱讀對應原文。")}</p>
    {placements.length > 0 && <button type="button" className="tensions-related-toggle" aria-expanded={showRelated} aria-controls={`${panelId}-related`} onClick={() => setShowRelated(!showRelated)}><ChorusIcon kind="responses" />{showRelated ? t("Hide related responses", "收起相關回應") : t("View related responses", "查看相關回應")}</button>}
    {showRelated && <ul className="tensions-related" id={`${panelId}-related`}>{placements.map(item => <li key={item.responseId}><button type="button" aria-pressed={selected?.responseId === item.responseId} onClick={() => { setPicked(item.responseId); setPlotPage(Math.floor((markers.find(marker => marker.responseId === item.responseId)?.lane ?? 0) / 2)); }}>{byId.get(item.responseId)!.text}</button></li>)}</ul>}
  </section>;
}
