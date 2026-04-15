import { ICONS } from './Icons';

interface ToastProps {
  message: string;
}

export function Toast({ message }: ToastProps) {
  return (
    <div className={`toast ${message ? 'visible' : ''}`}>
      {ICONS.check}
      <span>{message}</span>
    </div>
  );
}
