"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function JoinIndex() {
  const router = useRouter();
  const [code, setCode] = useState("");
  return (
    <div className="orbit-student orbit-student-code">
      <header className="student-header"><Brand light /></header>
      <form
        className="student-card space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const next = code.trim().toUpperCase();
          if (next) router.push(`/join/${next}`);
        }}
      >
        <h1 className="font-sans text-4xl">Join a discussion</h1>
        <div className="space-y-2">
          <Label htmlFor="code">Room code</Label>
          <Input
            id="code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            autoComplete="off"
            autoCapitalize="characters"
            className="font-mono tracking-[0.3em]"
          />
        </div>
        <Button type="submit" size="touch" disabled={!code.trim()}>
          Join
        </Button>
      </form>
    </div>
  );
}
