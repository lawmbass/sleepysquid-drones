// Row actions: one small primary button plus a ⋯ menu. The menu is rendered in a portal with fixed
// positioning so table/card overflow never clips it. Keyboard: Enter/Space/ArrowDown open, arrows/Home/End
// move, Escape or Tab closes and returns focus. Clicking outside, scrolling or resizing closes it.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { FiMoreHorizontal } from 'react-icons/fi';

export const primaryBtn = 'inline-flex items-center justify-center whitespace-nowrap rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:opacity-50';
export const secondaryBtn = 'inline-flex items-center justify-center whitespace-nowrap rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50';
const stop = (e) => e.stopPropagation();

/** Primary action: a link (href) or a button (onClick). Clicks never bubble to the row. */
export function RowPrimary({ href, onClick, children, testid, disabled, variant = 'primary' }) {
  const cls = variant === 'secondary' ? secondaryBtn : primaryBtn;
  if (href) return <Link href={href} className={cls} onClick={stop} data-testid={testid}>{children}</Link>;
  return <button type="button" className={cls} disabled={disabled} onClick={(e) => { e.stopPropagation(); onClick?.(); }} data-testid={testid}>{children}</button>;
}

/** items: [{ label, onSelect?, href?, danger?, disabled?, testid? } | { divider: true }]. Empty → renders nothing. */
export default function RowMenu({ items, label = 'More actions', testid, keepSpace = false }) {
  const list = (items || []).filter(Boolean);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const close = useCallback((refocus = true) => { setOpen(false); if (refocus) btnRef.current?.focus(); }, []);
  const focusables = () => [...(menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || [])];

  useLayoutEffect(() => {
    if (!open || !btnRef.current || !menuRef.current) return;
    const b = btnRef.current.getBoundingClientRect(); const m = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth; const vh = window.innerHeight;
    const left = Math.max(8, Math.min(b.right - m.width, vw - m.width - 8));
    const top = b.bottom + 4 + m.height > vh - 8 && b.top - 4 - m.height > 8 ? b.top - 4 - m.height : b.bottom + 4;
    setPos({ top, left });
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    focusables()[0]?.focus();
    const onDown = (e) => { if (!menuRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) close(false); };
    const onMove = () => close(false);
    document.addEventListener('mousedown', onDown); document.addEventListener('touchstart', onDown);
    window.addEventListener('resize', onMove); window.addEventListener('scroll', onMove, true);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown); window.removeEventListener('resize', onMove); window.removeEventListener('scroll', onMove, true); };
  }, [open, close]);

  if (!list.some((i) => !i.divider)) return keepSpace ? <span className="inline-block h-8 w-8 flex-shrink-0" aria-hidden="true" /> : null;
  const onMenuKey = (e) => {
    const els = focusables(); const i = els.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') close(false);
    else if (e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); els[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); els[els.length - 1]?.focus(); }
  };
  const itemCls = (i) => `flex w-full items-center whitespace-nowrap px-3 py-2 text-left text-sm focus:outline-none disabled:opacity-50 ${i.danger ? 'text-red-600 dark:text-red-400 hover:bg-red-50 focus:bg-red-50 dark:hover:bg-red-900/30 dark:focus:bg-red-900/30' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 focus:bg-gray-100 dark:hover:bg-gray-700 dark:focus:bg-gray-700'}`;
  const menu = open && typeof document !== 'undefined' && createPortal(
    <div ref={menuRef} role="menu" aria-label={label} onKeyDown={onMenuKey} onClick={stop} data-testid="row-menu"
      style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
      className="z-50 min-w-[11rem] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-lg ring-1 ring-black/5">
      {list.map((i, n) => i.divider ? <div key={`d${n}`} role="separator" className="my-1 border-t border-gray-100 dark:border-gray-700" />
        : i.href ? <Link key={i.label} href={i.href} role="menuitem" tabIndex={-1} className={itemCls(i)} data-testid={i.testid} onClick={() => setOpen(false)}>{i.label}</Link>
        : <button key={i.label} type="button" role="menuitem" tabIndex={-1} disabled={i.disabled} className={itemCls(i)} data-testid={i.testid} onClick={() => { setOpen(false); i.onSelect?.(); }}>{i.label}</button>)}
    </div>, document.body);
  return (
    <>
      <button ref={btnRef} type="button" aria-haspopup="menu" aria-expanded={open} aria-label={label} data-testid={testid || 'row-menu-button'}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true); } }}
        className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border text-gray-500 dark:text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${open ? 'border-gray-300 bg-gray-100 dark:border-gray-600 dark:bg-gray-700' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
        <FiMoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>
      {menu}
    </>
  );
}

/** Drop leading/trailing/double dividers so callers can build menus conditionally. */
export function tidy(items) {
  const out = [];
  for (const i of items.filter(Boolean)) { if (i.divider && (!out.length || out[out.length - 1].divider)) continue; out.push(i); }
  while (out.length && out[out.length - 1].divider) out.pop();
  return out;
}
