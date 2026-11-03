import Link from "next/link";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5">
      <span
        className={`grid size-9 place-items-center rounded-lg font-serif text-lg ${
          light ? "bg-[#f3ecdf] text-[#1e1a16]" : "bg-[#1e1a16] text-[#f3ecdf]"
        }`}
      >
        C
      </span>
      <span className="leading-tight">
        <span className={`block font-serif text-xl ${light ? "text-[#f3ecdf]" : "text-[#1e1a16]"}`}>
          Chorus
        </span>
        <span className={`block text-xs ${light ? "text-[#d7cbb8]" : "text-[#5c5348]"}`}>
          Discussion, grouped
        </span>
      </span>
    </Link>
  );
}
