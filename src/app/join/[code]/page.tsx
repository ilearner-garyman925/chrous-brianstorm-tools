import { Suspense } from "react";
import { JoinRoom } from "@/components/join-room";
import { RoomFallback } from "@/components/room-fallback";

export default function Page({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<RoomFallback label="Finding the discussion…" />}>
      <JoinGate params={params} />
    </Suspense>
  );
}

async function JoinGate({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <JoinRoom code={code.toUpperCase()} />;
}
