import { useRef } from 'react';
import { CommandHistory } from '@/lib/commands/command';

export function useCommandHistory() {
  const history = useRef(new CommandHistory());

  return {
    history: history.current,
    canUndo: history.current.canUndo(),
    canRedo: history.current.canRedo(),
  };
}