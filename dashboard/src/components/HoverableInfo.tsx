import React, { useState, useRef, useCallback, useEffect, useId } from "react";
import { createPortal } from "react-dom";

interface HoverableInfoProps {
  tooltip?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  as?: "span" | "div";
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * Affiche un tooltip riche au survol (et au focus clavier), rendu dans un portal
 * sur `document.body` pour ne jamais être coupé par un parent en `overflow: hidden`.
 */
export default function HoverableInfo({ tooltip, children, className = "", as = "span", onClick }: HoverableInfoProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const tooltipId = useId();

  const show = useCallback(() => {
    if (!ref.current || !tooltip) return;
    const rect = ref.current.getBoundingClientRect();
    setCoords({ top: rect.top, left: rect.left + rect.width / 2 });
  }, [tooltip]);

  const hide = useCallback(() => setCoords(null), []);

  useEffect(() => {
    if (!coords) return;
    const onScroll = () => setCoords(null);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [coords]);

  const Tag = as as any;
  return (
    <Tag
      ref={ref}
      className={className}
      onMouseEnter={show}
      onMouseLeave={hide}
      onMouseDown={hide}
      onFocus={show}
      onBlur={hide}
      onClick={onClick}
      aria-describedby={coords && tooltip ? tooltipId : undefined}
    >
      {children}
      {coords && tooltip
        ? createPortal(
            <div
              role="tooltip"
              id={tooltipId}
              style={{
                position: "fixed",
                top: coords.top - 8,
                left: coords.left,
                transform: "translate(-50%, -100%)",
                background: "#333",
                color: "white",
                padding: "6px 10px",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 400,
                whiteSpace: "pre-wrap",
                maxWidth: 360,
                pointerEvents: "none",
                zIndex: 10000,
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              }}
            >
              {tooltip}
            </div>,
            document.body
          )
        : null}
    </Tag>
  );
}
