'use client';

import { Plus } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { MAX_TASK_TEXT_LENGTH } from '@/hooks/useTasks';

interface Props {
  onAdd: (text: string) => void;
}

export default function TaskInput({ onAdd }: Props) {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onAdd(value);
      setValue('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative group">
      <div
        className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all duration-300 ${
          isFocused
            ? 'bg-zinc-800/80 border-white/15 shadow-[0_0_20px_rgba(255,255,255,0.05)]'
            : 'bg-zinc-900/60 border-white/5 hover:border-white/10'
        }`}
      >
        <div
          className={`flex items-center justify-center w-6 h-6 rounded-full border-2 border-dashed transition-colors duration-300 ${
            isFocused ? 'border-white/30' : 'border-zinc-600'
          }`}
        >
          <Plus
            size={14}
            className={`transition-colors duration-300 ${
              isFocused ? 'text-white/50' : 'text-zinc-600'
            }`}
          />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          maxLength={MAX_TASK_TEXT_LENGTH}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Tambah tugas baru..."
          className="flex-1 bg-transparent text-white placeholder-zinc-500 text-sm outline-none"
          id="task-input"
          aria-label="Tambah tugas baru"
        />
        {value.trim() && (
          <button
            type="submit"
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-all duration-200 active:scale-95"
          >
            Enter ↵
          </button>
        )}
      </div>
    </form>
  );
}
