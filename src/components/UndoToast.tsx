'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

export interface UndoAction {
  id: string;
  message: string;
  onConfirm: () => Promise<void> | void;
  onUndo: () => void;
  duration?: number; // ms, default 8000
}

interface Props {
  actions: UndoAction[];
  onRemove: (id: string) => void;
}

function UndoToastItem({
  action,
  onRemove,
}: {
  action: UndoAction;
  onRemove: (id: string) => void;
}) {
  const duration = action.duration || 8000;
  const [remaining, setRemaining] = useState(duration);
  const [executing, setExecuting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);
  const doneRef = useRef(false);

  const doConfirm = useCallback(async () => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    setExecuting(true);
    try {
      await action.onConfirm();
    } catch { /* ignore */ }
    onRemove(action.id);
  }, [action, onRemove]);

  const doUndo = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    action.onUndo();
    onRemove(action.id);
  }, [action, onRemove]);

  useEffect(() => {
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const left = Math.max(0, duration - elapsed);
      setRemaining(left);
      if (left <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        doConfirm();
      }
    }, 50);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [duration, doConfirm]);

  const progress = Math.max(0, remaining / duration) * 100;

  return (
    <div className="bg-tatamy-black text-white rounded-xl shadow-2xl px-4 py-3 w-full animate-slide-up">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-sm flex-1 leading-snug">{action.message}</p>
        <p className="text-[10px] text-gray-400 shrink-0 tabular-nums">
          {Math.ceil(remaining / 1000)}s
        </p>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 bg-white/20 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-tatamy-red rounded-full transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={doUndo}
          disabled={executing}
          className="text-xs bg-white text-tatamy-black font-semibold px-4 py-2 rounded-lg hover:bg-gray-200 active:bg-gray-300 disabled:opacity-50 transition-colors"
        >
          Vrátit zpět
        </button>
        <button
          onClick={doConfirm}
          disabled={executing}
          className="text-xs bg-tatamy-red text-white font-semibold px-4 py-2 rounded-lg hover:bg-tatamy-red-dark active:bg-tatamy-red-dark disabled:opacity-50 transition-colors"
        >
          {executing ? 'Provádím...' : 'Potvrdit hned'}
        </button>
      </div>
    </div>
  );
}

export default function UndoToast({ actions, onRemove }: Props) {
  if (actions.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[400px] z-[200] flex flex-col gap-2">
      {actions.map((action) => (
        <UndoToastItem key={action.id} action={action} onRemove={onRemove} />
      ))}
    </div>
  );
}
