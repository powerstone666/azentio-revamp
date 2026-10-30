'use client';

import { useState, useRef, useEffect, useSyncExternalStore, type FormEvent } from 'react';
import {
  X,
  PaperPlaneTilt,
  Sparkle,
  CircleNotch,
  User,
} from '@phosphor-icons/react';
import { gsap, useGSAP } from '@/app/(ui)/motion/gsap';
import AiraMarkdown from './AiraMarkdown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: { title: string; category: string; url: string }[];
}

const DEFAULT_SUGGESTIONS = [
  'How does AMLOCK sanctions screening work?',
  'How does iMAL Islamic Banking work?',
  'What is the Collective Learning Hub?',
  'Client vs Employee portals',
  'Technology & architecture',
];

const EXTERNAL_AI_CONSENT_KEY = 'aira_external_ai_consent';
const EXTERNAL_AI_CONSENT_EVENT = 'aira-external-ai-consent-change';

function subscribeExternalAiConsent(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(EXTERNAL_AI_CONSENT_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(EXTERNAL_AI_CONSENT_EVENT, callback);
  };
}

function getExternalAiConsent() {
  try { return window.sessionStorage.getItem(EXTERNAL_AI_CONSENT_KEY) === 'true'; }
  catch { return false; }
}

function updateExternalAiConsent(value: boolean) {
  try {
    if (value) window.sessionStorage.setItem(EXTERNAL_AI_CONSENT_KEY, 'true');
    else window.sessionStorage.removeItem(EXTERNAL_AI_CONSENT_KEY);
  } catch {
    // External processing stays opt-in for each message if session storage is unavailable.
  }
  window.dispatchEvent(new Event(EXTERNAL_AI_CONSENT_EVENT));
}

export default function AiraWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const externalAiConsent = useSyncExternalStore(subscribeExternalAiConsent, getExternalAiConsent, () => false);
  const consentDismissed = externalAiConsent;
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
  const isFirstRender = useRef(true);

  // ─── GSAP Motion for Launcher Button & Idle Breathing ─────
  useGSAP(
    () => {
      if (!launcherRef.current) return;
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Entrance animation
        gsap.fromTo(
          launcherRef.current,
          { y: 20, autoAlpha: 0, scale: 0.9 },
          { y: 0, autoAlpha: 1, scale: 1, duration: 0.5, ease: 'back.out(1.4)', delay: 0.2 }
        );

        // Idle float breathing
        gsap.to(launcherRef.current, {
          y: -4,
          duration: 2.2,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          delay: 0.8,
        });
      });

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(launcherRef.current, { autoAlpha: 1, y: 0, scale: 1 });
      });
    },
    { scope: containerRef }
  );

  // ─── GSAP Open / Close Animation ──────────────────────────
  useGSAP(
    () => {
      if (!cardRef.current || !launcherRef.current) return;
      const mm = gsap.matchMedia();

      // On initial mount when closed, guarantee hidden state without firing the closing animation!
      if (isFirstRender.current) {
        isFirstRender.current = false;
        if (!isOpen) {
          gsap.set(cardRef.current, {
            autoAlpha: 0,
            scale: 0.88,
            y: 24,
            transformOrigin: 'bottom right',
          });
          return;
        }
      }

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        if (isOpen) {
          // Open Card Timeline
          const tl = gsap.timeline();
          tl.to(launcherRef.current, {
            scale: 0.8,
            autoAlpha: 0,
            duration: 0.2,
            ease: 'power2.in',
          }).to(
            cardRef.current,
            {
              autoAlpha: 1,
              scale: 1,
              y: 0,
              duration: 0.35,
              ease: 'back.out(1.2)',
            },
            '-=0.1'
          );
        } else {
          // Close Card Timeline
          const tl = gsap.timeline();
          tl.to(cardRef.current, {
            autoAlpha: 0,
            scale: 0.88,
            y: 20,
            duration: 0.24,
            ease: 'power2.in',
          }).to(
            launcherRef.current,
            {
              scale: 1,
              autoAlpha: 1,
              duration: 0.3,
              ease: 'back.out(1.4)',
            },
            '-=0.1'
          );
        }
      });

      mm.add('(prefers-reduced-motion: reduce)', () => {
        if (isOpen) {
          gsap.set(launcherRef.current, { autoAlpha: 0 });
          gsap.set(cardRef.current, { autoAlpha: 1, scale: 1, y: 0 });
        } else {
          gsap.set(cardRef.current, { autoAlpha: 0 });
          gsap.set(launcherRef.current, { autoAlpha: 1, scale: 1, y: 0 });
        }
      });
    },
    { dependencies: [isOpen], scope: containerRef }
  );

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 250);
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
      const messageElements = messagesContainerRef.current.querySelectorAll('[data-aira-msg-item]');
      const latestMsg = messageElements[messageElements.length - 1];

      if (latestMsg) {
        mm.add('(prefers-reduced-motion: no-preference)', () => {
          gsap.fromTo(
            latestMsg,
            { y: 14, autoAlpha: 0, scale: 0.98 },
            { y: 0, autoAlpha: 1, scale: 1, duration: 0.28, ease: 'power2.out' }
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
  async function sendMessage(textToSend: string, allowExternalProcessing?: boolean) {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    const useExternalAi = allowExternalProcessing !== undefined ? allowExternalProcessing : externalAiConsent;

    const userMsg: Message = {
      id: `u-${crypto.randomUUID()}`,
      role: 'user',
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages
        .filter((m) => m.id !== 'greeting')
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/v1/aira/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history, allow_external_processing: useExternalAi }),
      });

      if (!res.ok) {
        throw new Error('Failed to get answer from AIRA');
      }

      const data = await res.json();
      const sources = Array.isArray(data.sources)
        ? data.sources.filter((source: unknown) => source && typeof source === 'object'
            && typeof (source as { title?: unknown }).title === 'string'
            && typeof (source as { url?: unknown }).url === 'string'
            && (source as { url: string }).url.startsWith('/'))
        : [];
      const assistantMsg: Message = {
        id: `a-${crypto.randomUUID()}`,
        role: 'assistant',
        sources,
        content:
          data.answer ||
          "I couldn't locate specific information on that. Azentio provides purpose-built BFSI software across Banking, Capital Markets, Insurance, and Risk & Compliance. Visit our [Solutions](/solutions) page to explore further.",
      };

      setMessages((prev) => [...prev, assistantMsg]);
      if (Array.isArray(data.suggestedQueries) && data.suggestedQueries.length > 0) {
        setSuggestions(data.suggestedQueries.slice(0, 5));
      }
    } catch (err) {
      console.error('AIRA request error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${crypto.randomUUID()}`,
          role: 'assistant',
          content:
            "Sorry, I encountered a temporary connection issue. You can explore our enterprise offerings directly on our [Solutions](/solutions) page.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    sendMessage(input, externalAiConsent);
  }

  return (
    <div ref={containerRef}>
      {/* ─── Floating Launcher Trigger (Bottom Right) ──────── */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          ref={launcherRef}
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open AIRA assistant"
          className="group flex cursor-pointer items-center gap-3 rounded-full border border-az-navy/20 bg-az-navy py-2.5 pl-3.5 pr-5 text-white shadow-xl transition-all duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:bg-[#214354] active:scale-[0.94] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-az-mint"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-az-mint text-az-navy transition-transform duration-200 group-hover:rotate-12 group-hover:scale-105">
            <Sparkle size={18} weight="fill" aria-hidden="true" />
          </span>
          <span className="text-[14px] font-semibold tracking-wide text-white">Ask AIRA</span>
        </button>
      </div>

      {/* ─── Sleek Azentio AIRA Card Window (Exact Style) ──── */}
      <div
        ref={cardRef}
        role="dialog"
        aria-label="AIRA Assistant"
        style={{
          visibility: 'hidden',
          opacity: 0,
          transform: 'translateY(24px) scale(0.88)',
          transformOrigin: 'bottom right',
        }}
        className={`fixed bottom-6 right-4 z-50 flex h-[580px] w-[calc(100vw-32px)] max-w-[400px] flex-col overflow-hidden rounded-[20px] bg-white shadow-2xl transition-shadow sm:right-6 border border-gray-200 ${
          isOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        {/* Solid Dark Navy Header with Subheading */}
        <div className="flex items-center justify-between bg-az-navy px-5 py-3.5 text-white">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-az-mint text-az-navy shadow-xs">
              <Sparkle size={18} weight="fill" />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-az-navy">
                <span className="h-2 w-2 rounded-full bg-az-mint animate-pulse" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[17px] font-bold tracking-tight text-white leading-tight">AIRA</h3>
                <span className="rounded-full bg-az-mint/20 border border-az-mint/30 px-2 py-0.5 text-[10px] font-bold tracking-wider text-az-mint uppercase">
                  AI GUIDE
                </span>
              </div>
              <p className="text-[11px] font-normal text-white/75 truncate">Azentio Intelligence &amp; Website Guide</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close AIRA chat"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white/80 transition-all hover:bg-white/10 hover:text-white active:scale-90 focus-visible:outline-none"
          >
            <X size={18} weight="bold" aria-hidden="true" />
          </button>
        </div>

        {/* Chat Messages Body (Clean White Canvas) */}
        <div
          ref={messagesContainerRef}
          className="flex-1 space-y-4 overflow-y-auto bg-white p-4"
        >
          {messages.map((m) => (
            <div
              key={m.id}
              data-aira-msg-item
              className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'user' ? (
                // User Message: with Human Profile Avatar on right
                <div className="flex items-start justify-end gap-2.5 max-w-[88%]">
                  <div className="flex flex-col items-end">
                    <span className="text-[11px] font-semibold text-gray-400 mr-1 mb-1">You</span>
                    <div className="rounded-[18px] rounded-tr-xs bg-az-navy px-4 py-2.5 text-[14px] leading-relaxed text-white shadow-xs">
                      <p className="text-white font-medium text-[14px] leading-relaxed break-words">{m.content}</p>
                    </div>
                  </div>
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-az-navy text-az-mint border border-az-mint/30 shadow-xs mt-0.5"
                    aria-hidden="true"
                  >
                    <User size={15} weight="bold" />
                  </div>
                </div>
              ) : (
                // Assistant Message: with AIRA Agent Profile Avatar on left
                <div className="flex items-start gap-2.5 max-w-[94%]">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-az-mint text-az-navy border border-az-navy/10 shadow-xs mt-0.5"
                    aria-hidden="true"
                  >
                    <Sparkle size={15} weight="fill" />
                  </div>
                  <div className="flex flex-col items-start flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 ml-1 mb-1">
                      <span className="text-[12px] font-bold text-az-navy">AIRA</span>
                      <span className="text-[10px] text-gray-500 font-medium">Azentio Guide</span>
                    </div>
                    <div className="rounded-[18px] rounded-tl-xs bg-[#F8FAFC] border border-emerald-100/90 p-4 text-[14px] leading-relaxed text-az-navy shadow-xs w-full">
                      <div className="flex items-center gap-1.5 pb-2 mb-2.5 border-b border-gray-200/60">
                        <span className="h-2 w-2 rounded-full bg-az-mint shrink-0" />
                        <span className="text-[10px] font-bold tracking-wider text-az-navy/70 uppercase">AIRA Intelligence</span>
                      </div>
                      <AiraMarkdown text={m.content} sources={m.sources} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div data-aira-msg-item className="flex items-start gap-2.5 max-w-[94%]">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-az-mint text-az-navy border border-az-navy/10 shadow-xs mt-0.5"
                aria-hidden="true"
              >
                <Sparkle size={15} weight="fill" />
              </div>
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-1.5 ml-1 mb-1">
                  <span className="text-[12px] font-bold text-az-navy">AIRA</span>
                  <span className="text-[10px] text-gray-500 font-medium">Azentio Guide</span>
                </div>
                <div className="flex items-center gap-2 rounded-[18px] rounded-tl-xs bg-[#F8FAFC] border border-emerald-100/90 px-4 py-2.5 text-[13px] text-az-navy shadow-xs">
                  <CircleNotch size={15} weight="bold" className="animate-spin text-az-navy" aria-hidden="true" />
                  <span className="font-medium text-az-navy/80">AIRA is writing...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Quick Topics (Pill Buttons Row matching reference) */}
        <div className="border-t border-gray-100 bg-white px-4 pt-2 pb-2">
          <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase mb-1.5">Suggested Topics</p>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {suggestions.map((topic, i) => (
              <button
                key={i}
                type="button"
                onClick={() => sendMessage(topic, externalAiConsent)}
                disabled={loading}
                className="shrink-0 cursor-pointer rounded-full border border-gray-300 bg-white px-3.5 py-1 text-[12px] font-medium text-az-navy transition-all duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:border-az-navy hover:bg-gray-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>{topic}</span>
                <span className="text-gray-400 text-[11px]">&gt;</span>
              </button>
            ))}
          </div>
        </div>

        {/* Input Form Bar (Rounded Pill Container matching reference) */}
        <div className="bg-white p-3 pt-1 border-t border-gray-100">
          {/* External AI Consent Notice (fades out and goes off once ticked) */}
          {!consentDismissed ? (
            <div className="mb-2 rounded-lg bg-gray-50 border border-gray-200/80 p-2 text-[11px] leading-snug text-gray-600 transition-all">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={externalAiConsent}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    if (checked) {
                      updateExternalAiConsent(true);
                    }
                  }}
                  disabled={loading}
                  className="mt-0.5 accent-az-navy cursor-pointer"
                />
                <span>For this message, allow the message and recent chat to be processed by our external AI provider if the website guide cannot answer locally. Do not include client confidential or personal data.</span>
              </label>
            </div>
          ) : (
            <div className="flex items-center justify-between px-1 mb-1.5 text-[10px] text-gray-400">
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                External AI enabled
              </span>
              <button
                type="button"
                onClick={() => {
                  updateExternalAiConsent(false);
                }}
                className="text-gray-400 hover:text-az-navy cursor-pointer underline text-[10px]"
              >
                Change
              </button>
            </div>
          )}
          <form
            onSubmit={handleSubmit}
            className="flex items-center rounded-full border border-gray-300 focus-within:border-az-navy bg-white px-3.5 py-1.5 transition-all shadow-xs"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask AIRA about products, portals..."
              disabled={loading}
              className="flex-1 bg-transparent px-1 text-[14px] text-az-navy placeholder:text-gray-400 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              aria-label="Send message"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-az-mint text-az-navy transition-all duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:bg-[#3EE6A6] active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? (
                <CircleNotch size={16} weight="bold" className="animate-spin" aria-hidden="true" />
              ) : (
                <PaperPlaneTilt size={16} weight="fill" aria-hidden="true" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
