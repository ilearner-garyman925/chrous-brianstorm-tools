import { Suspense } from "react";
import { Desk } from "@/components/desk";
import { RoomFallback } from "@/components/room-fallback";

export default function Page({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<RoomFallback label="Opening the teacher desk…" />}>
      <HostGate params={params} />
    </Suspense>
  );
}

async function HostGate({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <Desk code={code.toUpperCase()} />;
}
