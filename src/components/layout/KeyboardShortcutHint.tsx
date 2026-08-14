'use client';

import { Keyboard, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const shortcuts = [
  { key: 'Space', label: 'Play / Pause' },
  { key: 'R', label: 'Reset Timer' },
  { key: '1', label: 'Mode Focus' },
  { key: '2', label: 'Mode Short Break' },
  { key: '3', label: 'Mode Long Break' },
  { key: 'S', label: 'Buka Pengaturan' },
];

export default function KeyboardShortcutHint() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="relative z-40 mb-5 ml-auto mr-4 flex min-h-11 w-fit items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/90 px-3 py-2 text-zinc-300 shadow-lg backdrop-blur-md transition-colors hover:border-white/20 hover:text-white sm:mr-6 lg:mr-8"
        id="keyboard-shortcut-btn"
        aria-label="Lihat keyboard shortcuts"
        title="Keyboard shortcuts"
      >
        <Keyboard size={16} />
        <span className="text-xs font-medium hidden sm:inline">Shortcuts</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200" role="dialog" aria-modal="true" aria-labelledby="keyboard-shortcuts-heading">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <div className="flex items-center gap-3">
                <Keyboard size={20} className="text-indigo-400" />
                <h2 id="keyboard-shortcuts-heading" className="text-lg font-semibold text-white">
                  Keyboard Shortcuts
                </h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-zinc-400 hover:text-white transition-colors rounded-full hover:bg-zinc-800"
                aria-label="Tutup keyboard shortcuts"
                title="Tutup"
              >
                <X size={20} />
              </button>
            </div>

            {/* Shortcut List */}
            <div className="p-6 space-y-3">
              {shortcuts.map((s) => (
                <div
                  key={s.key}
                  className="flex items-center justify-between py-1"
                >
                  <span className="text-sm text-zinc-300">{s.label}</span>
                  <kbd className="px-2.5 py-1 bg-zinc-800 border border-white/10 rounded-lg text-xs font-mono text-zinc-300 shadow-[0_2px_0_rgba(255,255,255,0.05)]">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6">
              <p className="text-[11px] text-zinc-600 text-center">
                Shortcut tidak aktif saat mengetik di input field
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
