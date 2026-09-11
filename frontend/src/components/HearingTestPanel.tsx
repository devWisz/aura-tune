"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Ear, EarOff, Play, RotateCcw, Volume2, Wand2 } from "lucide-react";
import { useAudioStore } from "@/store/useAudioStore";
import { audioEngine } from "@/lib/audio/audioEngine";
import {
  Audiogram,
  TEST_FREQUENCIES,
  TOTAL_STEPS,
  TestStep,
  audiogramToEQGains,
  buildTestPlan,
  describeAudiogram,
  emptyAudiogram,
  stepToAmplitude,
} from "@/lib/audio/hearingTest";
import { Button, Chip, Panel } from "@/components/ui/Primitives";
import { cn } from "@/lib/cn";

type Phase = "intro" | "running" | "done";

/** Audiogram plot — sensitivity per ear across the tested frequencies. */
const AudiogramChart: React.FC<{ audiogram: Audiogram }> = ({ audiogram }) => {
  const width = 520;
  const height = 180;
  const pad = { left: 34, right: 12, top: 14, bottom: 26 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const x = (i: number) => pad.left + (i / (TEST_FREQUENCIES.length - 1)) * plotW;
  // Higher step == heard at a quieter level == better, so it plots higher up.
  const y = (step: number) => pad.top + (1 - Math.max(0, step) / (TOTAL_STEPS - 1)) * plotH;

  const path = (values: number[]) =>
    values
      .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
      .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full"
      role="img"
      aria-label="Measured hearing sensitivity by frequency for each ear"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line
          key={t}
          x1={pad.left}
          x2={width - pad.right}
          y1={pad.top + t * plotH}
          y2={pad.top + t * plotH}
          stroke="rgba(255,255,255,0.07)"
        />
      ))}

      <text x={pad.left - 6} y={pad.top + 4} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.35)">
        keen
      </text>
      <text x={pad.left - 6} y={pad.top + plotH} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.35)">
        dull
      </text>

      {TEST_FREQUENCIES.map((f, i) => (
        <text
          key={f}
          x={x(i)}
          y={height - 8}
          textAnchor="middle"
          fontSize="9"
          fill="rgba(255,255,255,0.35)"
          fontFamily="ui-monospace, monospace"
        >
          {f >= 1000 ? `${f / 1000}k` : f}
        </text>
      ))}

      <path d={path(audiogram.left)} fill="none" stroke="rgb(56,208,255)" strokeWidth="2" strokeLinejoin="round" />
      <path d={path(audiogram.right)} fill="none" stroke="rgb(149,122,255)" strokeWidth="2" strokeLinejoin="round" />

      {audiogram.left.map((v, i) => (
        <circle key={`l${i}`} cx={x(i)} cy={y(v)} r="3" fill="rgb(56,208,255)" />
      ))}
      {audiogram.right.map((v, i) => (
        <rect key={`r${i}`} x={x(i) - 2.6} y={y(v) - 2.6} width="5.2" height="5.2" fill="rgb(149,122,255)" />
      ))}
    </svg>
  );
};

export const HearingTestPanel: React.FC = () => {
  const { audiogram, setAudiogram, applyAudiogram, clearAudiogram, masterVolume } = useAudioStore();

  const [phase, setPhase] = useState<Phase>(audiogram ? "done" : "intro");
  const [plan] = useState<TestStep[]>(() => buildTestPlan());
  const [planIndex, setPlanIndex] = useState(0);
  const [level, setLevel] = useState(0);
  const draftRef = useRef<Audiogram>(emptyAudiogram());

  const current = plan[planIndex];

  // Present the tone for the current step. Every dependency change retriggers
  // it, which is what makes the staircase audible as the level drops.
  useEffect(() => {
    if (phase !== "running" || !current) return;
    audioEngine.init();
    void audioEngine.resume();
    audioEngine.startTestTone(current.frequency, current.ear, stepToAmplitude(level, current.frequency));
    return () => audioEngine.stopTestTone();
  }, [phase, current, level]);

  // Never leave a tone ringing if the panel unmounts mid-test.
  useEffect(() => () => audioEngine.stopTestTone(), []);

  const recordAndAdvance = useCallback(
    (thresholdStep: number) => {
      const freqIndex = TEST_FREQUENCIES.indexOf(current.frequency);
      draftRef.current[current.ear][freqIndex] = thresholdStep;

      if (planIndex + 1 >= plan.length) {
        audioEngine.stopTestTone();
        const finished: Audiogram = { ...draftRef.current, createdAt: Date.now() };
        setAudiogram(finished);
        setPhase("done");
        return;
      }
      setPlanIndex((i) => i + 1);
      setLevel(0);
    },
    [current, planIndex, plan.length, setAudiogram]
  );

  const handleHeard = () => {
    // Heard at the quietest level we can present — treat that as the ceiling.
    if (level >= TOTAL_STEPS - 1) return recordAndAdvance(TOTAL_STEPS - 1);
    setLevel((l) => l + 1);
  };

  const handleNotHeard = () => recordAndAdvance(Math.max(0, level - 1));

  const start = () => {
    draftRef.current = emptyAudiogram();
    setPlanIndex(0);
    setLevel(0);
    setPhase("running");
  };

  const progress = phase === "running" ? (planIndex / plan.length) * 100 : 0;

  return (
    <Panel
      title="Hearing Profile"
      subtitle="Measure your own response, then let the EQ compensate for it"
      icon={<Ear size={15} />}
      actions={
        audiogram && phase === "done" ? (
          <Button variant="ghost" onClick={() => { clearAudiogram(); setPhase("intro"); }}>
            <RotateCcw size={13} /> Clear
          </Button>
        ) : null
      }
      bodyClassName="space-y-4"
    >
      {/* ---------- Intro ---------- */}
      {phase === "intro" && (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-3">
            <p className="text-[12px] leading-relaxed text-dim">
              The studio plays a series of quiet sine tones, one ear at a time, getting softer each
              time you say you can hear them. Where you stop hearing each tone becomes your
              threshold, and the difference between frequencies becomes a correction curve.
            </p>
            <ul className="space-y-1.5 text-[11px] leading-relaxed text-faint">
              <li>• Put your headphones on and sit somewhere quiet.</li>
              <li>• Set a comfortable master volume first — it stays fixed for the whole test.</li>
              <li>• 16 measurements, roughly two minutes.</li>
            </ul>
            <p className="at-inset px-3 py-2.5 text-[11px] leading-relaxed text-faint">
              This is a listening aid, not a medical test. It cannot diagnose anything, and real
              audiometry uses calibrated hardware in a sound-treated booth. If you are worried about
              your hearing, see an audiologist.
            </p>
          </div>

          <div className="at-inset flex flex-col items-center justify-center gap-3 p-6 text-center">
            <Volume2 size={22} className="text-accent" />
            <p className="text-[12px] text-dim">
              Master volume is at{" "}
              <span className="at-mono text-ink">{Math.round(masterVolume * 100)}%</span>
            </p>
            <Button variant="primary" size="md" onClick={start}>
              <Play size={14} /> Start hearing test
            </Button>
          </div>
        </div>
      )}

      {/* ---------- Running ---------- */}
      {phase === "running" && current && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="at-label">
                Test {planIndex + 1} of {plan.length}
              </span>
              <span className="at-mono text-[11px] text-faint">
                level {level + 1}/{TOTAL_STEPS}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-sunken">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="at-inset flex flex-col items-center gap-4 px-6 py-8 text-center">
            <div className="flex items-center gap-6">
              <div
                className={cn(
                  "flex flex-col items-center gap-1.5 transition-opacity",
                  current.ear === "left" ? "opacity-100" : "opacity-25"
                )}
              >
                <span
                  className={cn(
                    "grid h-11 w-11 place-items-center rounded-full",
                    current.ear === "left" ? "bg-accent/15 text-accent ring-1 ring-accent/40" : "text-faint"
                  )}
                >
                  <Ear size={18} />
                </span>
                <span className="at-label">Left</span>
              </div>

              <div className="text-center">
                <div className="at-mono text-[26px] font-semibold leading-none text-ink">
                  {current.frequency >= 1000
                    ? `${current.frequency / 1000} kHz`
                    : `${current.frequency} Hz`}
                </div>
                <p className="mt-1.5 text-[11px] text-faint">Listen carefully</p>
              </div>

              <div
                className={cn(
                  "flex flex-col items-center gap-1.5 transition-opacity",
                  current.ear === "right" ? "opacity-100" : "opacity-25"
                )}
              >
                <span
                  className={cn(
                    "grid h-11 w-11 place-items-center rounded-full",
                    current.ear === "right" ? "bg-accent2/15 text-accent2 ring-1 ring-accent2/40" : "text-faint"
                  )}
                >
                  <Ear size={18} className="-scale-x-100" />
                </span>
                <span className="at-label">Right</span>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2 pt-1">
              <Button variant="primary" size="md" onClick={handleHeard}>
                I can hear it
              </Button>
              <Button size="md" onClick={handleNotHeard}>
                <EarOff size={14} /> Nothing there
              </Button>
            </div>
            <p className="max-w-sm text-[11px] leading-relaxed text-faint">
              Each time you confirm, the tone drops by 5 dB. Say &ldquo;nothing there&rdquo; as soon as
              you are no longer certain you hear it.
            </p>
          </div>
        </div>
      )}

      {/* ---------- Results ---------- */}
      {phase === "done" && audiogram && (
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="at-inset p-3">
            <AudiogramChart audiogram={audiogram} />
            <div className="mt-2 flex items-center justify-center gap-4">
              <span className="at-mono flex items-center gap-1.5 text-[10px] text-faint">
                <span className="h-[2px] w-4 rounded bg-accent" /> Left ear
              </span>
              <span className="at-mono flex items-center gap-1.5 text-[10px] text-faint">
                <span className="h-[2px] w-4 rounded bg-accent2" /> Right ear
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <Chip tone="ok">Profile captured</Chip>
            <p className="text-[12px] leading-relaxed text-dim">{describeAudiogram(audiogram)}</p>

            <div className="at-inset space-y-1.5 p-3">
              <span className="at-label">Suggested correction</span>
              <div className="flex items-end gap-[3px]">
                {audiogramToEQGains(audiogram).map((gain, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-sm bg-accent/70"
                      style={{ height: `${Math.max(2, (gain / 12) * 34)}px` }}
                    />
                    <span className="at-mono text-[8px] text-faint">
                      {gain > 0 ? `+${gain}` : gain}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={applyAudiogram}>
                <Wand2 size={13} /> Apply to equaliser
              </Button>
              <Button onClick={start}>
                <RotateCcw size={13} /> Retest
              </Button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
};
