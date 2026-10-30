'use client';

import { useId, useState } from 'react';
import { Card, PillButton, SectionTitle, Table, Td, Th } from '@/app/(ui)/components/portal/kit/ui';
import { Pill } from '@/app/(ui)/components/portal/kit/Status';
import { OFFERINGS, RATINGS, SCENARIOS, type OfferingId } from '@/app/(ui)/components/portal/employee/playground-data';

const STEP_LABEL = 'text-xs font-semibold uppercase tracking-wider text-az-text-muted';

// Same pill look as the kit PillButton, with onClick (the kit button takes no handler).
function ActionButton({ children, onClick, tone = 'mint', disabled = false }: { children: string; onClick: () => void; tone?: 'mint' | 'outline'; disabled?: boolean }) {
  const cls = tone === 'mint'
    ? 'bg-az-mint text-az-navy hover:bg-az-mint/80'
    : 'border-2 border-az-navy text-az-navy hover:bg-az-navy hover:text-white';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-[50px] px-6 py-2.5 text-[15px] font-semibold transition-all duration-150 cursor-pointer active:scale-[0.96] ease-[cubic-bezier(0.34,1.56,0.64,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-az-green disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}

export function PlaygroundRunner({ persist = false }: { persist?: boolean }) {
  const [offering, setOffering] = useState<OfferingId | null>(null);
  const [ran, setRan] = useState(false);
  const [rating, setRating] = useState<(typeof RATINGS)[number] | ''>('');
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);
  const [runId, setRunId] = useState('');
  const [runOutput, setRunOutput] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [serverMessage, setServerMessage] = useState('');
  const ratingName = useId();
  const commentId = useId();

  const scenario = offering ? SCENARIOS[offering] : null;
  const offeringName = offering ? OFFERINGS.find((o) => o.id === offering)?.name : '';

  function choose(id: OfferingId) {
    setOffering(id);
    setRan(false);
    setRating('');
    setComment('');
    setSent(false);
    setRunId('');
    setRunOutput([]);
    setServerMessage('');
  }

  function reset() {
    setOffering(null);
    setRan(false);
    setRating('');
    setComment('');
    setSent(false);
    setRunId('');
    setRunOutput([]);
    setServerMessage('');
  }

  async function run() {
    if (!scenario || !offering) return;
    setBusy(true);
    setServerMessage('');
    try {
      if (persist) {
        const response = await fetch('/api/v1/employee/playground/runs', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offering_id: offering }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'The demonstration could not be saved.');
        setRunId(result.data.id);
        setRunOutput(result.data.output_snapshot.lines);
      } else {
        setRunId('demo');
        setRunOutput(scenario.output);
      }
      setRan(true);
      setSent(false);
    } catch (error) {
      setServerMessage(error instanceof Error ? error.message : 'The demonstration could not be saved.');
    } finally { setBusy(false); }
  }

  async function submitFeedback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rating || !runId) return;
    setBusy(true);
    setServerMessage('');
    try {
      if (persist) {
        const response = await fetch(`/api/v1/employee/playground/runs/${runId}/feedback`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating, comment }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'Feedback could not be saved.');
        setServerMessage('Feedback saved.');
      } else {
        setServerMessage('Demo preview: feedback is not stored.');
      }
      setSent(true);
    } catch (error) {
      setServerMessage(error instanceof Error ? error.message : 'Feedback could not be saved.');
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-8">
      <Card>
        <p className={STEP_LABEL}>Step 1 of 4</p>
        <div className="mt-2"><SectionTitle>Choose an offering</SectionTitle></div>
        <div className="grid gap-4 md:grid-cols-3">
          {OFFERINGS.map((o) => {
            const selected = offering === o.id;
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={selected}
                onClick={() => choose(o.id)}
                className={`rounded-[12px] border-2 p-5 text-left shadow-card transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-az-green ${selected ? 'border-az-navy bg-az-mint-tint' : 'border-transparent bg-white hover:border-az-grey-bg'}`}
              >
                <span className="block text-[17px] font-semibold text-az-navy">{o.name}</span>
                <span className="mt-2 block text-sm text-az-text">{o.blurb}</span>
                {selected && <span className="mt-3 inline-block"><Pill tone="navy">Selected</Pill></span>}
              </button>
            );
          })}
        </div>
      </Card>

      {!scenario && (
        <p className="text-sm text-az-text-muted">Choose an offering to start the guided demonstration. Steps 2 to 4 appear after you choose.</p>
      )}

      {scenario && (
        <>
          <Card>
            <p className={STEP_LABEL}>Step 2 of 4</p>
            <div className="mt-2"><SectionTitle>Inspect inputs</SectionTitle></div>
            <p className="mb-5 text-sm text-az-text">{scenario.inputsCaption}</p>
            <Table>
              <thead>
                <tr>{scenario.columns.map((c) => <Th key={c}>{c}</Th>)}</tr>
              </thead>
              <tbody>
                {scenario.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => <Td key={j}>{cell}</Td>)}
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card>
            <p className={STEP_LABEL}>Step 3 of 4</p>
            <div className="mt-2"><SectionTitle>Run demonstration</SectionTitle></div>
            <p className="mb-5 text-sm text-az-text">Runs a fixed, simulated output for {offeringName}. Nothing is sent to a live system.</p>
            <ActionButton onClick={run} disabled={busy}>{busy ? 'Saving run…' : 'Run demonstration'}</ActionButton>
            {serverMessage && !sent && <p role="alert" className="mt-3 text-sm text-az-text">{serverMessage}</p>}
            {ran && (
              <div className="mt-6 rounded-[12px] border border-az-grey-bg bg-az-grey-bg/40 p-5" role="status">
                <p className="mb-3 inline-flex rounded-[50px] bg-az-navy px-3 py-1 text-xs font-semibold text-white">Simulated, not an approved credit or business decision</p>
                <div className="space-y-2 text-sm text-az-text">
                  {runOutput.map((line) => <p key={line}>{line}</p>)}
                </div>
              </div>
            )}
          </Card>

          {ran && (
            <Card>
              <p className={STEP_LABEL}>Step 4 of 4</p>
              <div className="mt-2"><SectionTitle>Review evidence</SectionTitle></div>
              <ul className="mb-8 list-disc space-y-2 pl-5 text-sm text-az-text">
                {scenario.evidence.map((e) => <li key={e}>{e}</li>)}
              </ul>

              {!sent ? (
                <form
                  onSubmit={submitFeedback}
                  className="max-w-xl space-y-6"
                >
                  <fieldset>
                    <legend className="mb-3 text-sm font-semibold text-az-navy">How useful was this demonstration?</legend>
                    <div className="flex flex-wrap gap-3">
                      {RATINGS.map((r) => (
                        <label key={r} className="inline-flex cursor-pointer items-center gap-2 rounded-[50px] border-2 border-az-grey-bg px-4 py-2 text-sm text-az-text transition-colors duration-150 has-[:checked]:border-az-navy has-[:checked]:bg-az-mint-tint has-[:checked]:font-semibold has-[:checked]:text-az-navy">
                          <input
                            type="radio"
                            name={ratingName}
                            value={r}
                            checked={rating === r}
                            required={r === RATINGS[0]}
                            onChange={() => setRating(r)}
                            className="accent-az-navy"
                          />
                          {r}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div>
                    <label htmlFor={commentId} className="mb-2 block text-sm font-semibold text-az-navy">Comment (optional)</label>
                    <textarea
                      id={commentId}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={4}
                      maxLength={2000}
                      className="w-full rounded-[12px] border border-az-grey-bg bg-white p-3 text-sm text-az-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-az-green"
                    />
                  </div>
                  <PillButton type="submit" disabled={busy || !rating}>{busy ? 'Saving…' : 'Submit feedback'}</PillButton>
                </form>
              ) : (
                <div className="space-y-4">
                  <p className="rounded-[12px] bg-az-mint-tint p-4 text-sm font-semibold text-az-navy" role="status">{serverMessage}</p>
                  <ActionButton tone="outline" onClick={reset}>Start again</ActionButton>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
