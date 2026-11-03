export function RoomFallback({ label }: { label: string }) {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <p className="font-serif text-2xl text-[#5c5348]">{label}</p>
    </div>
  );
}
