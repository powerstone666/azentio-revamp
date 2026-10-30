'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import {
  X,
  PaperPlaneTilt,
  Sparkle,
  ArrowRight,
  CaretRight,
  BookOpen,
  CircleNotch,
} from '@phosphor-icons/react';
import { gsap, useGSAP } from '@/app/(ui)/motion/gsap';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: { title: string; category: string; url?: string }[];
}

const DEFAULT_SUGGESTIONS = [
  'Products overview',
  'AMLOCK sanctions',
  'iMAL Islamic banking',
  'Collective learning',
  '60s withdrawal SLA',
];

export default function AiraWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'greeting',
      role: 'assistant',
      content:
        "Hi, I’m **AIRA** — Azentio's website guide & AI assistant.\n\nAsk me about our enterprise BFSI products, client & employee portals, collective learning hub, or how to explore the site.",
    },
  ]);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── GSAP Motion for Launcher Button (Material 3 Expressive) ──
  useGSAP(
    () => {
      if (!launcherRef.current) return;
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Initial entrance with gentle spring overshoot
        gsap.fromTo(
          launcherRef.current,
          { y: 28, autoAlpha: 0, scale: 0.94 },
          { y: 0, autoAlpha: 1, scale: 1, duration: 0.55, ease: 'back.out(1.4)', delay: 0.3 }
        );

        // Subtle purposeful idle float
        gsap.to(launcherRef.current, {
          y: -3,
          duration: 2.4,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          delay: 0.9,
        });
      });

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(launcherRef.current, { autoAlpha: 1, y: 0, scale: 1 });
      });
    },
    { scope: containerRef }
  );

  // ─── Open/Close Handlers ───────────────────────────────────
  function openWidget() {
    setIsRendered(true);
    setIsOpen(true);
  }

  function closeWidget() {
    if (!cardRef.current) {
      setIsOpen(false);
      setIsRendered(false);
      return;
    }

    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.to(cardRef.current, {
        scale: 0.9,
        y: 16,
        autoAlpha: 0,
        duration: 0.22,
        ease: 'power2.in',
        onComplete: () => {
          setIsOpen(false);
          setIsRendered(false);
        },
      });
    });

    mm.add('(prefers-reduced-motion: reduce)', () => {
      setIsOpen(false);
      setIsRendered(false);
    });
  }

  // Animate card reveal when opened
  useGSAP(
    () => {
      if (!isRendered || !cardRef.current) return;
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo(
          cardRef.current,
          { scale: 0.9, autoAlpha: 0, y: 20, transformOrigin: 'bottom right' },
          { scale: 1, autoAlpha: 1, y: 0, duration: 0.35, ease: 'power3.out' }
        );

        gsap.from('[data-aira-header]', {
          y: -8,
          autoAlpha: 0,
          duration: 0.25,
          ease: 'power2.out',
          delay: 0.08,
        });

        gsap.from('[data-aira-input]', {
          y: 8,
          autoAlpha: 0,
          duration: 0.25,
          ease: 'power2.out',
          delay: 0.12,
        });
      });

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(cardRef.current, { scale: 1, autoAlpha: 1, y: 0 });
      });
    },
    { dependencies: [isRendered], scope: containerRef }
  );

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Auto-scroll messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  // ─── Animate New Message with GSAP ─────────────────────────
  useGSAP(
    () => {
      if (!messagesContainerRef.current) return;
      const mm = gsap.matchMedia();
      const messageElements = messagesContainerRef.current.querySelectorAll('[data-aira-message]');
      const latestMsg = messageElements[messageElements.length - 1];

      if (latestMsg) {
        mm.add('(prefers-reduced-motion: no-preference)', () => {
          gsap.fromTo(
            latestMsg,
            { y: 12, autoAlpha: 0, scale: 0.98 },
            { y: 0, autoAlpha: 1, scale: 1, duration: 0.3, ease: 'power2.out' }
          );
        });
        mm.add('(prefers-reduced-motion: reduce)', () => {
          gsap.set(latestMsg, { autoAlpha: 1, y: 0, scale: 1 });
        });
      }
    },
    { dependencies: [messages.length], scope: containerRef }
  );

  // ─── Send Message ──────────────────────────────────────────
  async function sendMessage(textToSend: string) {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages
        .filter((m) => m.id !== 'greeting')
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/v1/aira/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
      });

      if (!res.ok) {
        throw new Error('Failed to get answer from AIRA');
      }

      const data = await res.json();
      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.answer || "I couldn't process that query. Please try asking about our products, portals, or architecture.",
        sources: data.sources,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      if (Array.isArray(data.suggestedQueries) && data.suggestedQueries.length > 0) {
        setSuggestions(data.suggestedQueries.slice(0, 4));
      }
    } catch (err) {
      console.error('AIRA request error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: "Sorry, I encountered a temporary connection issue. You can explore our offerings directly on our [Solutions](/solutions) page.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    sendMessage(input);
  }

  function formatContent(text: string) {
    const lines = text.split('\n');
    return lines.map((line, lineIdx) => {
      // H3 markdown
      if (line.startsWith('### ')) {
        return (
          <h4 key={lineIdx} className="mb-2 mt-3 font-semibold text-az-navy text-[15px] border-b border-az-mint-tint pb-1">
            <span className="span-border-bottom text-az-navy">{line.replace('### ', '')}</span>
          </h4>
        );
      }

      // Bullets
      const isBullet = line.startsWith('- ') || line.startsWith('• ');
      const content = isBullet ? line.slice(2) : line;

      // Inline formatting for links and bold
      const parts = content.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g);
      const renderedParts = parts.map((part, i) => {
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
          return (
            <Link
              key={i}
              href={linkMatch[2]}
              className="inline-flex cursor-pointer items-center gap-1 rounded-[50px] bg-az-mint-tint px-2.5 py-0.5 font-semibold text-az-navy transition-colors hover:bg-az-mint hover:underline"
            >
              <span>{linkMatch[1]}</span>
              <ArrowRight size={10} weight="bold" aria-hidden="true" />
            </Link>
          );
        }
        const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
        if (boldMatch) {
          return <strong key={i} className="font-semibold text-az-navy">{boldMatch[1]}</strong>;
        }
        return part;
      });

      if (isBullet) {
        return (
          <div key={lineIdx} className="my-1.5 flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-az-green" aria-hidden="true" />
            <div className="flex-1 text-[13.5px] leading-relaxed text-az-text">{renderedParts}</div>
          </div>
        );
      }

      if (!line.trim()) {
        return <div key={lineIdx} className="h-2" />;
      }

      return (
        <p key={lineIdx} className="my-1 text-[13.5px] leading-relaxed text-az-text">
          {renderedParts}
        </p>
      );
    });
  }

  return (
    <div ref={containerRef}>
      {/* ─── Floating Launcher Trigger (Material 3 + Azentio) ── */}
      <div className="fixed bottom-6 right-6 z-50">
        {!isOpen && (
          <button
            ref={launcherRef}
            type="button"
            onClick={openWidget}
            aria-label="Open AIRA intelligence guide"
            className="group flex cursor-pointer items-center gap-3 rounded-[50px] border-2 border-az-mint/50 bg-az-navy py-2.5 pl-3 pr-5 text-white shadow-card transition-all duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:border-az-mint hover:bg-az-navy-light active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-az-mint"
          >
            {/* Dual-tone Azentio Avatar Icon */}
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-az-mint text-az-navy transition-transform duration-200 group-hover:rotate-12 group-hover:scale-105">
              <Sparkle size={18} weight="fill" aria-hidden="true" />
              {/* Green active status indicator */}
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-az-green ring-2 ring-az-navy animate-pulse" aria-hidden="true" />
            </span>
            <div className="text-left">
              <span className="block text-[13.5px] font-semibold tracking-wide text-white">Ask AIRA</span>
              <span className="block text-[10px] text-az-mint-tint/90">Azentio Intelligence</span>
            </div>
          </button>
        )}
      </div>

      {/* ─── Redesigned Azentio AIRA Card Window ───────────────── */}
      {isRendered && (
        <div
          ref={cardRef}
          role="dialog"
          aria-label="AIRA Guide Chatbot"
          className="fixed bottom-6 right-4 z-50 flex h-[600px] w-[calc(100vw-32px)] max-w-[420px] flex-col overflow-hidden rounded-[22px] border border-az-navy/20 bg-white shadow-2xl sm:right-6"
        >
          {/* Top Decorative Azentio Signature Gradient Strip */}
          <div className="h-1.5 w-full bg-gradient-to-r from-az-mint via-az-green to-az-mint" aria-hidden="true" />

          {/* Header in Azentio Deep Navy */}
          <div data-aira-header className="flex items-center justify-between bg-az-navy px-5 py-3.5 text-white">
            <div className="flex items-center gap-3">
              {/* Avatar Chip with Green status badge */}
              <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-az-mint text-az-navy shadow-sm">
                <Sparkle size={20} weight="fill" aria-hidden="true" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-az-green ring-2 ring-az-navy" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[17px] font-semibold text-white tracking-wide">AIRA</h3>
                  <span className="rounded-[50px] bg-az-mint/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-az-mint border border-az-mint/30">
                    AI Guide
                  </span>
                </div>
                <p className="text-[11px] text-white/75">Grounded in Azentio source.md & offerings</p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeWidget}
              aria-label="Close AIRA chat"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white/80 transition-colors duration-150 hover:bg-white/10 hover:text-white active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-az-mint"
            >
              <X size={18} weight="bold" aria-hidden="true" />
            </button>
          </div>

          {/* Chat Messages Body */}
          <div
            ref={messagesContainerRef}
            className="flex-1 space-y-4 overflow-y-auto bg-[#F7F9FB] p-4 text-sm"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                data-aira-message
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                {/* Message Bubble */}
                <div
                  className={`max-w-[90%] rounded-[18px] p-4 text-[14px] leading-relaxed shadow-sm ${
                    m.role === 'user'
                      ? 'rounded-tr-xs bg-az-navy text-white shadow-md'
                      : 'rounded-tl-xs border border-az-mint/40 bg-white text-az-text'
                  }`}
                >
                  {/* Subtle Assistant Brand Identifier */}
                  {m.role === 'assistant' && (
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-az-navy/70 border-b border-az-grey-bg pb-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-az-green" aria-hidden="true" />
                      <span>AIRA Intelligence</span>
                    </div>
                  )}

                  {formatContent(m.content)}

                  {/* Document Source Chips */}
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-3.5 border-t border-az-grey-bg pt-2 text-[11px]">
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-az-text-muted">
                        <BookOpen size={12} weight="bold" className="text-az-navy" aria-hidden="true" />
                        <span>Sources cited:</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {m.sources.slice(0, 2).map((s, idx) => (
                          <span
                            key={idx}
                            title={s.title}
                            className="inline-flex max-w-[200px] truncate items-center gap-1 rounded-[50px] border border-az-mint/40 bg-az-mint-tint px-2.5 py-0.5 text-[10px] font-semibold text-az-navy"
                          >
                            {s.title.split(':')[0]}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading Indicator with Phosphor Spinner */}
            {loading && (
              <div data-aira-message className="flex items-start">
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-2 rounded-[16px] rounded-tl-xs border border-az-mint/30 bg-white px-4 py-3 shadow-sm text-az-navy"
                >
                  <CircleNotch size={16} weight="bold" className="animate-spin text-az-green" aria-hidden="true" />
                  <span className="text-xs font-medium text-az-text-muted">AIRA is searching source.md...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Chips Carousel */}
          <div className="border-t border-az-border/60 bg-white px-3.5 py-2.5">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-az-text-muted">
              Suggested topics
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {suggestions.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => sendMessage(chip)}
                  disabled={loading}
                  className="group shrink-0 inline-flex cursor-pointer items-center gap-1 rounded-[50px] border border-az-mint/40 bg-white px-3 py-1 text-xs font-semibold text-az-navy shadow-xs transition-all duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:border-az-mint hover:bg-az-mint-tint active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>{chip}</span>
                  <CaretRight size={10} weight="bold" className="text-az-navy transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>

          {/* Input Form in Azentio Signature Rounded Container */}
          <form data-aira-input onSubmit={onSubmit} className="border-t border-az-border/60 bg-white p-3">
            <div className="flex items-center gap-2 rounded-[50px] border border-az-navy/20 bg-az-grey-bg/70 p-1 pl-4 transition-colors focus-within:border-az-green focus-within:bg-white focus-within:ring-2 focus-within:ring-az-mint/50">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask AIRA about products, portals..."
                disabled={loading}
                className="flex-1 bg-transparent py-1.5 text-sm text-az-text placeholder:text-az-text-muted focus:outline-none disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                aria-label="Send message to AIRA"
                aria-busy={loading}
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-az-mint text-az-navy transition-all duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:bg-az-mint-hover active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:hover:bg-az-mint"
              >
                {loading ? (
                  <CircleNotch size={16} weight="bold" className="animate-spin" aria-hidden="true" />
                ) : (
                  <PaperPlaneTilt size={16} weight="bold" aria-hidden="true" />
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
