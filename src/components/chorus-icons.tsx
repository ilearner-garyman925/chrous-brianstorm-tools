import type { SVGProps } from "react";
type Props = SVGProps<SVGSVGElement> & { size?: number; kind: "cloud" | "themes" | "tensions" | "voices" | "group" | "responses" | "next" | "shared" };
const bubble = "M5 3h12a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H9l-5 3v-4a4 4 0 0 1-3-4V7a4 4 0 0 1 4-4Z";
export function ChorusIcon({size=20,kind,...props}:Props) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {kind==="next" ? <><path d="M17 8V6a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v7a4 4 0 0 0 3 4v4l4-4h4"/><path d="M19 12v9m-4.5-4.5h9" stroke="var(--brand-teal)" strokeWidth="2"/></> :
    kind==="shared" ? <><path d="M13 10h6a4 4 0 0 1 4 4v3a3 3 0 0 1-2 3v3l-4-3h-4a3 3 0 0 1-3-3v-3" fill="var(--brand-teal)" fillOpacity=".3" stroke="var(--brand-teal)"/><path d="M5 3h8a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H7l-4 4v-5a3 3 0 0 1-2-3V7a4 4 0 0 1 4-4Z" fill="var(--more-surface)"/></> :
    kind==="themes" ? <><rect x="2" y="2" width="14" height="14" rx="4"/><rect x="9" y="9" width="13" height="13" rx="4" fill="var(--brand-teal)" stroke="none"/><path d="M13 9h3v3a4 4 0 0 1-4 4H9v-3a4 4 0 0 1 4-4Z" fill="var(--brand-gold)" stroke="none"/></> :
    kind==="group" ? <><rect x="1.5" y="5" width="21" height="14" rx="5"/><rect x="5" y="9" width="4" height="6" rx="1.5" fill="var(--brand-teal)" stroke="none"/><rect x="10" y="9" width="4" height="6" rx="1.5" fill="var(--brand-gold)" stroke="none"/><rect x="15" y="9" width="4" height="6" rx="1.5" fill="var(--brand-teal)" stroke="none"/></> :
    kind==="tensions" ? <><path d="M4 4h4a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H6l-3 3v-4a3 3 0 0 1-2-3V7a3 3 0 0 1 3-3Z"/><path d="M16 4h4a3 3 0 0 1 3 3v5a3 3 0 0 1-2 3v3l-3-3h-2a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z" fill="var(--brand-gold)" stroke="none"/></> :
    kind==="cloud" ? <><path d="M4 2h7a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H7l-3 3v-3a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Z"/><path d="M16 7h4a3 3 0 0 1 3 3v2a3 3 0 0 1-2 3v3l-3-3h-2Z" fill="var(--brand-gold)" stroke="none"/><path d="M10 15h6a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3h-3l-3 2v-2a3 3 0 0 1-3-3v-1a3 3 0 0 1 3-3Z" fill="var(--brand-teal)" stroke="none"/></> :
    <><path d={bubble}/>{kind==="responses" && <path d="M6 8h10M6 13h7"/>}</>}
  </svg>;
}
