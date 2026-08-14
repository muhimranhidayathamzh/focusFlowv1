import { Settings, User } from "lucide-react";

export default function Navbar() {
  return (
    <nav className="relative z-20 mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Navigasi utama">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center">
          <span className="text-black font-bold text-lg leading-none">F</span>
        </div>
        <span className="text-xl font-bold tracking-tight">FocusFlow</span>
      </div>
      <div className="flex items-center gap-4">
        <button className="rounded-lg p-2.5 text-zinc-400 transition-colors hover:bg-zinc-800/50 hover:text-white" aria-label="Buka pengaturan" title="Pengaturan">
          <Settings size={20} />
        </button>
        <button className="rounded-lg p-2.5 text-zinc-400 transition-colors hover:bg-zinc-800/50 hover:text-white" aria-label="Buka profil pengguna" title="Profil pengguna">
          <User size={20} />
        </button>
      </div>
    </nav>
  );
}
