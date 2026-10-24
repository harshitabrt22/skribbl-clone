// GameScreen — the main game UI during WORD_SELECTION and DRAWING phases.
// 3-column layout: Leaderboard | Canvas + Toolbar | Chat
// Also shows WordPicker overlay (WORD_SELECTION) and RoundSummary overlay (ROUND_END).
//
// PRD: Section 7.4, 7.5

import React, { useState, useEffect } from 'react';
import { useGame } from '../state/GameContext';
import { DrawingCanvas } from '../components/DrawingCanvas';
import { Toolbar } from '../components/Toolbar';
import { WordPicker } from '../components/WordPicker';
import { WordDisplay } from '../components/WordDisplay';
import { ChatPanel } from '../components/ChatPanel';
import { Leaderboard } from '../components/Leaderboard';
import { RoundSummary } from '../components/RoundSummary';
import { DrawingTool, BrushSize } from '../types';

const CHALLENGE_EMOJIS: Record<string, string> = {
  TWO_COLORS: '🎨',
  ONE_STROKE: '✍️',
  SPEED_DRAW: '⚡',
  HONOR_NO_LETTERS: '🚫',
};

export const GameScreen: React.FC = () => {
  const { state, isDrawer, undoDraw, clearCanvas, leaveRoom, addToast, chooseWord, sendGuess, sendChat } = useGame();
  const { players, drawerId, phase, wordMask, wordLength, word, wordOptions, remaining, totalTime, chatEntries, roundSummary } = state;

  // Local drawing tool states for the active drawer
  const [currentTool, setCurrentTool] = useState<DrawingTool>('brush');
  const [currentColor, setCurrentColor] = useState<string>('#1E1B2E');
  const [currentSize, setCurrentSize] = useState<BrushSize>(10);

  // Track colors used in the current turn (for TWO_COLORS challenge)
  const [usedColors, setUsedColors] = useState<string[]>([]);

  // Reset usedColors on new turn or phase change
  useEffect(() => {
    if (phase === 'WORD_SELECTION' || phase === 'STARTING') {
      setUsedColors([]);
    }
  }, [phase, state.round]);

  const handleStrokeStart = (color: string, tool: DrawingTool) => {
    if (tool === 'brush') {
      setUsedColors((prev) => {
        const upper = color.toUpperCase();
        if (prev.some((c) => c.toUpperCase() === upper)) return prev;
        return [...prev, color];
      });
    }
  };

  // Summary is displayed whenever roundSummary is set; cleared by next round_start

  const drawerPlayer = players.find((p) => p.id === drawerId);
  const myPlayer = players.find((p) => p.id === state.you?.id);
  const hasGuessed = myPlayer?.hasGuessed ?? false;

  // Format timer as MM:SS
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const timerText = `${minutes}:${String(seconds).padStart(2, '0')}`;

  // Timer color: green → yellow → red as time runs out
  const timerColor =
    remaining > totalTime * 0.5
      ? 'var(--success)'
      : remaining > totalTime * 0.25
      ? 'var(--accent)'
      : 'var(--danger)';

  // Handle chat/guess input
  const handleSend = (text: string) => {
    if (phase === 'DRAWING' && !isDrawer) {
      sendGuess(text);
    } else {
      sendChat(text);
    }
  };

  return (
    <div
      style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: 'var(--space-12) var(--space-16)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-12)',
        height: 'calc(100vh - 60px)',
      }}
    >
      {/* ── Top bar: round info + word display + timer ── */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-12)',
          padding: 'var(--space-10) var(--space-20)',
        }}
      >
        {/* Left: round info & who is drawing */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 700 }}>
            Round {state.round} of {state.totalRounds}
          </span>
          <div style={{ fontSize: '0.9rem' }}>
            {isDrawer ? (
              <span>✏️ <strong>You are drawing!</strong></span>
            ) : (
              <span>👀 <strong>{drawerPlayer?.name || '…'}</strong> is drawing</span>
            )}
          </div>
        </div>

        {/* Center: word display */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <WordDisplay
            isDrawer={isDrawer}
            word={word}
            wordMask={wordMask}
            wordLength={wordLength}
            hintsRevealed={state.hintsRevealed}
            phase={phase}
          />
          {/* Challenge badge (PRD 7.4, 13.4) */}
          {phase === 'DRAWING' && state.activeChallenge && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 10px',
                borderRadius: 999,
                backgroundColor: state.activeChallenge.enforced ? 'rgba(255, 107, 74, 0.12)' : 'rgba(255, 210, 63, 0.25)',
                border: `1.5px solid ${state.activeChallenge.enforced ? 'var(--primary)' : 'var(--ink)'}`,
                fontSize: '0.78rem',
                fontWeight: 700,
              }}
              title={state.activeChallenge.description}
            >
              <span>{CHALLENGE_EMOJIS[state.activeChallenge.id] || '🃏'}</span>
              <span>{state.activeChallenge.title}</span>
              {state.activeChallenge.enforced ? (
                <span style={{ fontSize: '0.7rem', color: 'var(--primary)', marginLeft: 2 }}>+25</span>
              ) : (
                <span style={{ fontSize: '0.65rem', backgroundColor: 'var(--ink)', color: '#fff', padding: '1px 5px', borderRadius: 4 }}>
                  HONOR
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: timer + leave */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
          {phase === 'DRAWING' && (
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.6rem',
                fontWeight: 800,
                color: timerColor,
                minWidth: 56,
                textAlign: 'center',
              }}
              title="Time remaining"
            >
              {timerText}
            </span>
          )}
          <button className="btn btn-sm btn-danger" onClick={leaveRoom}>
            Leave
          </button>
        </div>
      </div>

      {/* ── Main 3-column layout ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '220px 1fr 260px',
          gap: 'var(--space-12)',
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* LEFT: Leaderboard */}
        <Leaderboard
          players={players}
          drawerId={drawerId}
          myId={state.you?.id ?? null}
        />

        {/* CENTER: Canvas + Toolbar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
          <DrawingCanvas
            isDrawer={isDrawer}
            currentTool={currentTool}
            currentColor={currentColor}
            currentSize={currentSize}
            onRejectToast={(reason) => addToast(reason, 'error')}
            onStrokeStart={handleStrokeStart}
          />
          <Toolbar
            isDrawer={isDrawer}
            currentTool={currentTool}
            currentColor={currentColor}
            currentSize={currentSize}
            activeChallenge={state.activeChallenge}
            usedColors={usedColors}
            onToolChange={setCurrentTool}
            onColorChange={setCurrentColor}
            onSizeChange={setCurrentSize}
            onUndo={undoDraw}
            onClear={clearCanvas}
          />
        </div>

        {/* RIGHT: Chat & Guesses */}
        <ChatPanel
          entries={chatEntries}
          isDrawer={isDrawer}
          hasGuessed={hasGuessed}
          phase={phase}
          onSend={handleSend}
        />
      </div>

      {/* ── WORD_SELECTION overlay ── */}
      {phase === 'WORD_SELECTION' && (
        <WordPicker
          isDrawer={isDrawer}
          drawerName={drawerPlayer?.name || '…'}
          wordOptions={wordOptions}
          challengeOffer={state.challengeOffer}
          onChoose={chooseWord}
        />
      )}

      {/* ── ROUND_END overlay ── */}
      {phase === 'ROUND_END' && roundSummary && (
        <RoundSummary
          word={roundSummary.word}
          reason={roundSummary.reason}
          scores={roundSummary.scores}
          challengeBonus={roundSummary.challengeBonus}
          challenge={roundSummary.challenge}
        />
      )}
    </div>
  );
};
