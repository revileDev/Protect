// components/Navbar.tsx
import Link from "next/link";
import { Shield, Key } from "lucide-react";
import ClaimScriptModal, { ScriptSummary } from "./ClaimScriptModal";

interface Props {
  scripts?: ScriptSummary[];
}

export default function Navbar({ scripts }: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-800/80 bg-[#0d0f16]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <span className="font-bold tracking-tight text-white text-sm">
              ATOM<span className="text-blue-500">PROTECT</span>
            </span>
            <span className="block text-[10px] text-gray-500 -mt-1 font-mono">
              Script Gateway
            </span>
          </div>
        </Link>

        {/* Claim Key button */}
        <div className="flex items-center gap-2.5">
          {scripts ? (
            <ClaimScriptModal
              scripts={scripts}
              buttonText="Claim Key"
              buttonClassName="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-sm shadow-blue-600/20"
            />
          ) : (
            <Link
              href="/claim"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition-colors shadow-sm shadow-blue-600/20"
            >
              <Key className="h-3.5 w-3.5" />
              Claim Key
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
