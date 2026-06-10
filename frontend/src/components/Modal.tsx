// ============================================================
// NERO PARTY - Modal: silky open/close (delayed unmount + exit animation)
// Captures the last children while open so the content stays put during the
// close animation, even when the parent clears its state immediately.
// ============================================================
import { useEffect, useRef, useState } from 'react';

export function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [render, setRender] = useState(open);
  const [closing, setClosing] = useState(false);
  const last = useRef<React.ReactNode>(children);
  if (open) last.current = children;

  useEffect(() => {
    if (open) {
      setRender(true);
      setClosing(false);
      return;
    }
    setClosing(true);
    const t = setTimeout(() => setRender(false), 210);
    return () => clearTimeout(t);
  }, [open]);

  // Escape closes the modal
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!render) return null;
  return (
    <div className={'modal-scrim' + (closing ? ' closing' : '')} onClick={onClose}>
      <div
        className={'modal-body' + (closing ? ' closing' : '')}
        onClick={(e) => e.stopPropagation()}
      >
        {last.current}
      </div>
    </div>
  );
}
