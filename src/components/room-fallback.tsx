export function RoomFallback({ label }: { label: string }) {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <p className="font-sans text-2xl text-[#586380]">{label}</p>
    </div>
  );
}
