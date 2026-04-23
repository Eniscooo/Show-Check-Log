"use client";
import { useState, useRef, useEffect } from "react";

export default function Dropdown({
    value,
    onChange,
    options,
    className = "",
    triggerClassName = "",
    dropdownClassName = "",
    style = {},
    placeholder = "Select…",
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [highlighted, setHighlighted] = useState(null);
    const dropdownRef = useRef(null);
    const listRef = useRef(null);

    const selectedOption = options.find((o) => o.value === value) ?? null;

    /* ── close on outside click ── */
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target))
                setIsOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    /* ── keyboard nav ── */
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => {
            if (e.key === "Escape") { setIsOpen(false); return; }
            if (e.key === "ArrowDown") {
                setHighlighted((h) => Math.min((h ?? -1) + 1, options.length - 1));
            } else if (e.key === "ArrowUp") {
                setHighlighted((h) => Math.max((h ?? options.length) - 1, 0));
            } else if (e.key === "Enter" && highlighted !== null) {
                onChange(options[highlighted].value);
                setIsOpen(false);
            }
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [isOpen, highlighted, options, onChange]);

    /* reset highlight when menu opens */
    useEffect(() => {
        if (isOpen) {
            setHighlighted(options.findIndex((o) => o.value === value) ?? null);
        }
    }, [isOpen]);

    return (
        <>
            <style>{`
                .dd-root { position: relative; display: inline-block; }

                /* ── trigger ── */
                .dd-trigger {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 7px 12px 7px 14px;
                    background: #fff;
                    border: 1.5px solid #e4e4e7;
                    border-radius: 10px;
                    font-family: 'Geist', 'DM Sans', ui-sans-serif, system-ui, sans-serif;
                    font-size: 13.5px;
                    font-weight: 500;
                    color: #18181b;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: border-color 120ms, box-shadow 120ms, background 120ms;
                    outline: none;
                    user-select: none;
                    line-height: 1.4;
                }
                .dd-trigger:hover {
                    border-color: #a1a1aa;
                    background: #fafafa;
                }
                .dd-trigger[data-open="true"] {
                    border-color: #6366f1;
                    box-shadow: 0 0 0 3px rgba(99,102,241,.15);
                    background: #fafafa;
                }
                .dd-trigger .placeholder { color: #a1a1aa; }

                /* ── chevron ── */
                .dd-chevron {
                    width: 14px;
                    height: 14px;
                    flex-shrink: 0;
                    color: #71717a;
                    transition: transform 200ms cubic-bezier(.34,1.4,.64,1), color 120ms;
                }
                .dd-trigger[data-open="true"] .dd-chevron {
                    transform: rotate(180deg);
                    color: #6366f1;
                }

                /* ── panel ── */
                .dd-panel {
                    position: absolute;
                    z-index: 200;
                    top: calc(100% + 6px);
                    left: 0;
                    min-width: 100%;
                    background: #fff;
                    border: 1.5px solid #e4e4e7;
                    border-radius: 12px;
                    box-shadow: 0 8px 24px -4px rgba(0,0,0,.10), 0 2px 6px -2px rgba(0,0,0,.06);
                    padding: 4px;
                    animation: dd-in 140ms cubic-bezier(.16,1,.3,1) both;
                    transform-origin: top center;
                }
                @keyframes dd-in {
                    from { opacity: 0; transform: scaleY(.94) translateY(-4px); }
                    to   { opacity: 1; transform: scaleY(1)  translateY(0); }
                }

                /* ── option ── */
                .dd-option {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    width: 100%;
                    padding: 7px 10px;
                    border-radius: 8px;
                    border: none;
                    background: transparent;
                    font-family: inherit;
                    font-size: 13.5px;
                    font-weight: 450;
                    color: #3f3f46;
                    text-align: left;
                    cursor: pointer;
                    transition: background 80ms, color 80ms;
                    white-space: nowrap;
                }
                .dd-option:hover, .dd-option[data-highlighted="true"] {
                    background: #f4f4f5;
                    color: #18181b;
                }
                .dd-option[data-selected="true"] {
                    background: #eef2ff;
                    color: #4f46e5;
                    font-weight: 500;
                }
                .dd-option[data-selected="true"]:hover {
                    background: #e0e7ff;
                }

                /* ── check ── */
                .dd-check {
                    width: 13px;
                    height: 13px;
                    flex-shrink: 0;
                    opacity: 0;
                    color: #4f46e5;
                }
                .dd-option[data-selected="true"] .dd-check { opacity: 1; }

                /* ── dark mode (.dark class) ── */
                .dark .dd-trigger {
                    background: rgba(30,41,59,.8);
                    border-color: rgba(51,65,85,.8);
                    color: #f8fafc;
                }
                .dark .dd-trigger:hover { background: #334155; border-color: #475569; }
                .dark .dd-trigger[data-open="true"] {
                    border-color: #6366f1;
                    box-shadow: 0 0 0 3px rgba(99,102,241,.25);
                    background: #334155;
                }
                .dark .dd-chevron { color: #94a3b8; }
                .dark .dd-trigger[data-open="true"] .dd-chevron { color: #818cf8; }
                .dark .dd-panel {
                    background: #1e293b;
                    border-color: #334155;
                    box-shadow: 0 8px 24px -4px rgba(0,0,0,.5), 0 2px 6px -2px rgba(0,0,0,.3);
                }
                .dark .dd-option { color: #cbd5e1; }
                .dark .dd-option:hover, .dark .dd-option[data-highlighted="true"] {
                    background: #334155;
                    color: #f8fafc;
                }
                .dark .dd-option[data-selected="true"] {
                    background: rgba(99,102,241,.15);
                    color: #818cf8;
                }
                .dark .dd-option[data-selected="true"] .dd-check { color: #818cf8; }
                .dark .dd-option[data-selected="true"]:hover { background: rgba(99,102,241,.25); }
                .dark .dd-trigger .placeholder { color: #52525b; }
            `}</style>

            <div
                className={`dd-root ${className}`}
                style={style}
                ref={dropdownRef}
            >
                <button
                    type="button"
                    className={`dd-trigger ${triggerClassName}`}
                    data-open={isOpen}
                    onClick={() => setIsOpen((o) => !o)}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                >
                    {selectedOption
                        ? <span>{selectedOption.label}</span>
                        : <span className="placeholder">{placeholder}</span>
                    }
                    <svg className="dd-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {isOpen && (
                    <div
                        className={`dd-panel ${dropdownClassName}`}
                        role="listbox"
                        ref={listRef}
                    >
                        {options.map((opt, i) => (
                            <button
                                key={opt.value}
                                type="button"
                                role="option"
                                aria-selected={value === opt.value}
                                className="dd-option"
                                data-selected={value === opt.value}
                                data-highlighted={highlighted === i}
                                onMouseEnter={() => setHighlighted(i)}
                                onMouseLeave={() => setHighlighted(null)}
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                            >
                                <span>{opt.label}</span>
                                <svg className="dd-check" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}