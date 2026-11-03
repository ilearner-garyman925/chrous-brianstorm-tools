import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="max-w-md space-y-3 text-center">
        <h1 className="font-serif text-3xl">That page is not in the room.</h1>
        <Link href="/" className="text-[#b8612d] underline-offset-4 hover:underline">
          Back to Chorus
        </Link>
      </div>
    </div>
  );
}
