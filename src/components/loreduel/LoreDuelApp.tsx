'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import {
  battleDefinitions,
  duelists,
  getMoveById,
  moves,
  getSelectedBattle,
  getStatusMeta,
  type BattleDefinition,
  type StatusEffect,
} from '../../lib/game'
import { readGenLayerStatus } from '../../lib/genlayer'
import { getExplorerUrl } from '../../lib/tx-history'
import { trackEvent } from '../../lib/analytics'
import { type SettingsData } from '../../lib/storage'
import { portraits, type SectionId } from './constants'
import { useGameInit } from './hooks/useGameInit'
import { useWallet } from './hooks/useWallet'
import { useBattleActions } from './hooks/useBattleActions'

export function LoreDuelApp() {
  const [statusNote, setStatusNote] = useState(readGenLayerStatus().summary)
  const [showSettings, setShowSettings] = useState(false)
  const [activeSection, setActiveSection] = useState<SectionId>('arena')

  const {
    runState, setRunState,
    profile, setProfile,
    settings, setSettings,
    tutorialDismissed, setTutorialDismissed,
    txHistory, setTxHistory,
    isOffline,
    storageWarning, setStorageWarning,
    hasLoaded,
  } = useGameInit()

  const { wallet, walletError, isConnecting, networkName, handleConnectWallet, handleDisconnectWallet, clearWalletError } =
    useWallet({ hasLoaded, onStatusChange: setStatusNote })

  const battle = getSelectedBattle(runState)

  const {
    isResolving,
    lastTxHash,
    retryPayload,
    handleMoveSelect,
    handlePlayRound,
    handleStartDemo,
    handleResetRun,
    handleEndRun,
  } = useBattleActions({
    runState,
    profile,
    battle,
    wallet,
    onRunStateChange: setRunState,
    onProfileChange: setProfile,
    onStatusChange: setStatusNote,
    onTxHistoryChange: setTxHistory,
  })

  const battleState = runState?.activeBattle
  const selectedMove = battleState ? getMoveById(battleState.selectedMoveId) : moves[0]
  const battleMoves = moves

  const animationEnabled = settings.animationIntensity !== 'none'
  const motionProps = animationEnabled
    ? { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } }
    : { initial: { opacity: 1, y: 0 }, animate: { opacity: 1, y: 0 } }

  function handleSettingChange<K extends keyof SettingsData>(key: K, value: SettingsData[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }))
    trackEvent({ type: 'settings_change', setting: key, value: String(value) })
  }

  function handleDismissTutorial() {
    setTutorialDismissed(true)
    trackEvent({ type: 'tutorial_dismissed' })
  }

  // Section scroll observer
  useEffect(() => {
    const sectionIds: SectionId[] = ['arena', 'moves', 'chronicle', 'guide']
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[]

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0]
        if (visible) setActiveSection(visible.target.id as SectionId)
      },
      { rootMargin: '-20% 0px -45% 0px', threshold: [0.2, 0.45, 0.7] },
    )

    elements.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [runState])

  // --- Loading shell ---
  if (!hasLoaded) {
    return (
      <div className="loading-shell" role="status" aria-label="Loading game">
        <div className="skeleton-block" style={{ width: '12rem', height: '1.5rem' }} />
        <p>Loading LoreDuel...</p>
      </div>
    )
  }

  // --- Landing page ---
  if (!runState) {
    return (
      <LandingPage
        wallet={wallet}
        isConnecting={isConnecting}
        isOffline={isOffline}
        storageWarning={storageWarning}
        networkName={networkName}
        battleMoves={battleMoves}
        onStartDemo={handleStartDemo}
        onConnectWallet={handleConnectWallet}
        onDisconnectWallet={handleDisconnectWallet}
        onDismissStorageWarning={() => setStorageWarning(null)}
      />
    )
  }

  // --- Main game UI ---
  return (
    <div className={`loreduel-shell ${settings.highContrast ? 'high-contrast' : ''}`}>
      <header className="topbar" role="banner">
        <div className="brand" translate="no">LoreDuel</div>
        <nav className="topnav" aria-label="Game navigation">
          {(['arena', 'moves', 'chronicle', 'guide'] as const).map((section) => (
            <a
              key={section}
              className={activeSection === section ? 'active' : ''}
              href={`#${section}`}
              aria-current={activeSection === section ? 'true' : undefined}
            >
              {section === 'arena' ? 'Sanctum' : section === 'moves' ? 'Arsenal' : section === 'chronicle' ? 'Chronicles' : 'Codex'}
            </a>
          ))}
        </nav>
        <div className="wallet-actions">
          <button className="settings-toggle" type="button" onClick={() => setShowSettings(!showSettings)} aria-label="Open settings">
            Settings
          </button>
          {wallet ? (
            <>
              <button className="wallet-button" type="button" aria-label={`Wallet ${wallet.shortAddress}`}>
                {wallet.shortAddress}
              </button>
              <button className="reset-button disconnect-btn" type="button" onClick={handleDisconnectWallet} aria-label="Disconnect wallet">
                X
              </button>
            </>
          ) : (
            <button className="wallet-button" type="button" onClick={handleConnectWallet}>
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </header>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={handleSettingChange}
          onClose={() => setShowSettings(false)}
        />
      )}

      {isOffline && <OfflineBanner />}
      {storageWarning && <StorageWarningBanner message={storageWarning} onDismiss={() => setStorageWarning(null)} />}
      {walletError && (
        <div className="wallet-error-banner" role="alert">
          <span>{walletError}</span>
          <button type="button" className="reset-button" onClick={clearWalletError} aria-label="Dismiss error">X</button>
        </div>
      )}

      <aside className="siderail" aria-label="Side navigation">
        <div className="siderail-rank">
          <span>Rank</span>
          <strong>{profile.wins >= 8 ? 'Mythic' : profile.wins >= 3 ? 'Ascendant' : 'Initiate'}</strong>
        </div>
        <div className="siderail-links">
          {(['arena', 'moves', 'chronicle', 'guide'] as const).map((section) => (
            <RailItem
              key={section}
              label={section === 'arena' ? 'Duel' : section === 'moves' ? 'Arsenal' : section === 'chronicle' ? 'Lore' : 'Codex'}
              href={`#${section}`}
              active={activeSection === section}
            />
          ))}
        </div>
      </aside>

      <main className="battlefield">
        {!tutorialDismissed && (
          <section className="tutorial-banner" role="region" aria-label="Tutorial">
            <div>
              <strong>How To Win This Run</strong>
              <p>Choose a move, cast the turn, then react to stance shifts and statuses shown below. Battle 1 teaches guard, battle 2 teaches counters, battle 3 is the boss.</p>
            </div>
            <button type="button" className="reset-button" onClick={handleDismissTutorial}>
              Dismiss
            </button>
          </section>
        )}

        <section className="campaign-strip" id="arena" role="region" aria-label="Campaign progress">
          <div className="campaign-header">
            <span className="hud-label">{battle.chapter.toUpperCase()}</span>
            <h1 className="hud-title">{battle.label.toUpperCase()}</h1>
          </div>
          <div className="campaign-path">
            {battleDefinitions.map((item, index) => (
              <div
                key={item.id}
                className={`path-node ${index < runState.currentBattleIndex ? 'complete' : index === runState.currentBattleIndex ? 'active' : ''}`}
              >
                <div className="node-square" />
                <span className="node-label">0{index + 1}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="stage" role="region" aria-label="Battle arena">
          <motion.article
            className="fighter fighter-left"
            {...(animationEnabled ? { initial: { opacity: 0, x: -40 }, animate: { opacity: 1, x: 0 }, transition: { duration: 0.5, ease: 'easeOut' } } : {})}
          >
            <PortraitCard imageUrl={portraits.player} name={duelists.player.name} title={duelists.player.title} align="left" />
            <CombatMeta
              resolve={battleState?.playerResolve ?? 0}
              maxResolve={14}
              stance={battleState?.playerStance ?? 'bulwark'}
              statuses={battleState?.playerStatuses ?? []}
              accent="var(--accent-amber)"
              reverse={false}
            />
          </motion.article>

          <div className="center-clash">
            <div className="oracle-chamber">
              <div className="chamber-header">
                <div className="pulse-diode" />
                <span className="hud-label">ORACLE&apos;S CHAMBER // ACTIVE_READOUT</span>
              </div>
              <div className="narration-panel">
                <blockquote className="oracle-quote">
                  {battleState?.lastVerdict?.oracleLine ?? initialOracleLine(battle)}
                </blockquote>
                <p className="narration-text">{battleState?.lastVerdict?.narration ?? battle.tutorialHint}</p>
                {battleState?.lastVerdict?.tacticalReason && (
                  <div className="tactical-readout">
                    <div className="readout-block">
                      <span className="hud-label">TACTICAL_REASON</span>
                      <p>{battleState.lastVerdict.tacticalReason}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="battle-metadata">
              <div className="meta-row">
                <span className="hud-label">SCENE</span>
                <span className="hud-value">{battle.scene.name.toUpperCase()}</span>
              </div>
              <div className="meta-row">
                <span className="hud-label">ADJUDICATION</span>
                <span className="hud-value">{wallet ? 'LIVE_RELAY' : 'DEMO_FALLBACK'}</span>
              </div>
            </div>

            <div className="action-hub">
              <div className="status-grid">
                <div className="status-item">
                  <span className="hud-label">TENSION</span>
                  <div className="mini-bar">
                    <div className="mini-bar-fill" style={{ width: `${battleState?.tension ?? battle.scene.tensionBase}%` }} />
                  </div>
                </div>
                <div className="status-item">
                  <span className="hud-label">SYSTEM_NOTE</span>
                  <span className="hud-value-small">{statusNote.toUpperCase()}</span>
                </div>
                {lastTxHash && (
                  <div className="status-item">
                    <span className="hud-label">LAST_TX</span>
                    <a className="tx-link" href={getExplorerUrl(lastTxHash, networkName)} target="_blank" rel="noopener noreferrer">
                      {lastTxHash.slice(0, 14)}...
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          <motion.article
            className="fighter fighter-right"
            {...(animationEnabled ? { initial: { opacity: 0, x: 40 }, animate: { opacity: 1, x: 0 }, transition: { duration: 0.5, ease: 'easeOut' } } : {})}
          >
            <PortraitCard
              imageUrl={portraits[battle.enemy.id as keyof typeof portraits] ?? portraits.morgana}
              name={battle.enemy.duelist.name}
              title={battle.enemy.duelist.title}
              align="right"
            />
            <CombatMeta
              resolve={battleState?.rivalResolve ?? 0}
              maxResolve={battle.id === 'battle-3' ? 16 : 13}
              stance={battleState?.rivalStance ?? 'bulwark'}
              statuses={battleState?.rivalStatuses ?? []}
              accent="var(--text-secondary)"
              reverse
            />
          </motion.article>
        </section>

        <section className="lower-deck">
          <div className="move-selection" id="moves">
            <div className="section-header">
              <span className="hud-label">ARSENAL_MODULE</span>
              <h3 className="hud-title">COMMIT_TURN</h3>
            </div>
            <div className="move-grid-tactical">
              {battleMoves.map((move, index) => (
                <button
                  key={move.id}
                  type="button"
                  className={`move-chip ${move.id === selectedMove.id ? 'active' : ''}`}
                  onClick={() => handleMoveSelect(move.id)}
                >
                  <div className="chip-header">
                    <span className="chip-stance">{move.stance.toUpperCase()}</span>
                    <span className="chip-index">0{index + 1}</span>
                  </div>
                  <strong className="chip-name">{move.name}</strong>
                  <p className="chip-summary">{move.summary}</p>
                </button>
              ))}
            </div>

            <div className="execution-bar">
              <div className="selected-preview">
                <span className="hud-label">INCANTATION_READY</span>
                <strong className="amber-text">&quot;{selectedMove.incantation.toUpperCase()}&quot;</strong>
              </div>
              <div className="execution-actions">
                {isResolving ? (
                  <button className="cast-button processing" disabled>
                    <span className="pulse-diode" /> RESOLVING_ADJUDICATION...
                  </button>
                ) : (
                  <button className="cast-button" type="button" onClick={handlePlayRound} disabled={!battleState}>
                    CAST_TURN
                  </button>
                )}
                {retryPayload && (
                  <button className="cast-button retry-btn" type="button" onClick={retryPayload}>
                    RE_ATTEMPT_ADJUDICATION
                  </button>
                )}
                <button className="reset-button" type="button" onClick={handleResetRun}>
                  RESTART_RUN
                </button>
              </div>
            </div>
          </div>

          <div className="chronicle-panel" id="chronicle">
            <div className="panel-title">
              <h3>Chronicle</h3>
              <span>{runState.chronicle.length} records</span>
            </div>
            <div className="profile-card">
              <strong>Duelist Profile</strong>
              <p>{profile.wins} wins / {profile.losses} losses</p>
              <p>Signature move: {getMoveById(profile.favoriteMoveId).name}</p>
              <p>Runs completed: {profile.runsCompleted}</p>
            </div>
            {txHistory.length > 0 && (
              <div className="profile-card">
                <strong>Chain Relay Log</strong>
                {txHistory.slice(0, 5).map((item) => (
                  <p key={item.txHash}>
                    <a className="tx-link" href={getExplorerUrl(item.txHash, networkName)} target="_blank" rel="noopener noreferrer">
                      {item.battleId} phase {item.round} {'->'} {item.txHash.slice(0, 10)}...
                    </a>
                  </p>
                ))}
              </div>
            )}
            {runState.chronicle.length === 0 && (
              <div className="empty-state">
                <p>No chronicle entries yet. Cast your first turn to begin the story.</p>
              </div>
            )}
            <AnimatePresence initial={false}>
              {runState.chronicle.map((entry) => (
                <motion.article
                  key={entry.id}
                  className="chronicle-item"
                  {...motionProps}
                  exit={animationEnabled ? { opacity: 0, y: -8 } : undefined}
                >
                  <div className="chronicle-head">
                    <span>{entry.battleLabel}</span>
                    <span>Round {entry.round}</span>
                  </div>
                  <strong>{entry.title}</strong>
                  <p>{entry.summary}</p>
                  {entry.txHash && (
                    <a className="tx-link" href={getExplorerUrl(entry.txHash, networkName)} target="_blank" rel="noopener noreferrer">
                      Tx {entry.txHash.slice(0, 10)}... {'->'}
                    </a>
                  )}
                </motion.article>
              ))}
            </AnimatePresence>
          </div>
        </section>

        <section className="guide-panel" id="guide" role="region" aria-label="Combat Codex">
          <div className="panel-title">
            <h3 className="hud-title">COMBAT_CODEX</h3>
            <span className="hud-label">TACTICAL_REFERENCE</span>
          </div>
          <div className="guide-steps">
            <article className="codex-card">
              <span className="codex-idx">01</span>
              <div className="codex-content">
                <strong className="hud-title-small">STANCE_TRIANGLE</strong>
                <p>Bulwark beats Trickster, Trickster beats Eclipse, Eclipse beats Bulwark. Match the room&apos;s favored stance for bonus pressure.</p>
              </div>
            </article>
            <article className="codex-card">
              <span className="codex-idx">02</span>
              <div className="codex-content">
                <strong className="hud-title-small">STATUS_EFFECTS</strong>
                <p>Guarded reduces damage. Burning adds chip damage. Shaken weakens defense. Focused empowers combos. Chain them wisely.</p>
              </div>
            </article>
            <article className="codex-card">
              <span className="codex-idx">03</span>
              <div className="codex-content">
                <strong className="hud-title-small">TENSION_SURGE</strong>
                <p>When tension exceeds 60%, Eclipse moves gain +2 power. High-tension battles reward aggressive play.</p>
              </div>
            </article>
          </div>
        </section>

        {runState.completed && (
          <section className="summary-banner" role="alert">
            <div>
              <strong>Run Complete</strong>
              <p>{runState.campaignSummary}</p>
            </div>
            <div className="cta-row">
              <button className="cast-button" type="button" onClick={handleResetRun}>Start New Run</button>
              <button className="reset-button" type="button" onClick={handleEndRun}>Back to Landing</button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

// --- Sub-components ---

type LandingPageProps = {
  wallet: ReturnType<typeof useWallet>['wallet']
  isConnecting: boolean
  isOffline: boolean
  storageWarning: string | null
  networkName: string
  battleMoves: typeof moves
  onStartDemo: () => void
  onConnectWallet: () => void
  onDisconnectWallet: () => void
  onDismissStorageWarning: () => void
}

function LandingPage({
  wallet,
  isConnecting,
  isOffline,
  storageWarning,
  networkName,
  battleMoves,
  onStartDemo,
  onConnectWallet,
  onDisconnectWallet,
  onDismissStorageWarning,
}: LandingPageProps) {
  return (
    <div className="landing-shell">
      <header className="topbar" role="banner">
        <div className="brand" translate="no">LoreDuel</div>
        <nav className="topnav" aria-label="Main navigation">
          <a className="active" href="#arena">Start</a>
          <a href="#guide">How It Works</a>
          <a href="#chronicle">Progression</a>
          <a href="#moves">Moves</a>
        </nav>
        <div className="wallet-actions">
          {wallet ? (
            <>
              <button className="wallet-button" type="button" aria-label="Connected wallet address" onClick={onDisconnectWallet}>
                {wallet.shortAddress}
              </button>
              <button className="reset-button disconnect-btn" type="button" onClick={onDisconnectWallet} aria-label="Disconnect wallet">
                Disconnect
              </button>
            </>
          ) : (
            <button className="wallet-button" type="button" onClick={onConnectWallet}>
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </header>

      {isOffline && <OfflineBanner />}
      {storageWarning && <StorageWarningBanner message={storageWarning} onDismiss={onDismissStorageWarning} />}

      <main className="landing-main">
        <section className="landing-hero" id="arena">
          <div className="landing-copy">
            <span className="hud-label">SYSTEM_ENTRY // STABLE_VERSION</span>
            <h1 className="hud-title-large">READ THE ROOM. CHOOSE A STANCE. SURVIVE THE VERDICT.</h1>
            <p className="hud-description">
              Experience the next generation of Intelligent Duelists. Connect to the GenLayer testnet for live adjudication, or enter the Demo Chamber to start immediately.
            </p>
            <div className="hero-actions">
              <button className="cast-button" type="button" onClick={onStartDemo}>ENTER_CHAMBER</button>
              <button className="reset-button" type="button" onClick={onConnectWallet}>
                {wallet ? `LINKED: ${wallet.shortAddress}` : 'LINK_GENLAYER_WALLET'}
              </button>
            </div>
            <div className="status-grid-mini">
              <div className="status-item">
                <span className="hud-label">STATUS</span>
                <span className="hud-value-small">{readGenLayerStatus().summary.toUpperCase()}</span>
              </div>
              <div className="status-item">
                <span className="hud-label">NETWORK</span>
                <span className="hud-value-small">{networkName.toUpperCase()}</span>
              </div>
            </div>
          </div>

          <div className="landing-progress-card" id="chronicle">
            <span className="hud-label">TACTICAL_INTEL</span>
            <h2 className="hud-title-mid">GRIMOIRE_EDITION // SPECS</h2>
            <ul className="spec-list">
              <li><div className="node-square mini" /> 3-Battle Campaign: Tutorial, Midgame, Boss Finale</li>
              <li><div className="node-square mini" /> 9 Tactical Moves across Bulwark, Trickster, and Eclipse</li>
              <li><div className="node-square mini" /> On-Chain Verdict Adjudication via GenLayer</li>
              <li><div className="node-square mini" /> Persistent Profile and Chronicle Progression</li>
            </ul>
          </div>
        </section>

        <section className="guide-panel landing-guide" id="guide">
          <div className="panel-title">
            <h3 className="hud-title">COMBAT_CODEX</h3>
            <span className="hud-label">LOAD_TIME: 45s</span>
          </div>
          <div className="guide-steps">
            {[
              { idx: '01', title: 'PICK_MOVE', body: 'Every incantation carries a stance weight. Balance your flow.' },
              { idx: '02', title: 'PROBE_RIVAL', body: 'Enemies adapt. Repeating strategies leaves you vulnerable.' },
              { idx: '03', title: 'ADAPT_FLOW', body: 'The Oracle remembers. Chain your actions into high-resolve combos.' },
            ].map(({ idx, title, body }) => (
              <article key={idx} className="codex-card">
                <span className="codex-idx">{idx}</span>
                <div className="codex-content">
                  <strong className="hud-title-small">{title}</strong>
                  <p>{body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="move-library" id="moves">
          {battleMoves.map((move, idx) => (
            <article key={move.id} className="library-card-tactical">
              <div className="card-idx">0{idx + 1}</div>
              <span className="hud-label">{move.stance.toUpperCase()}</span>
              <strong className="hud-title-small">{move.name}</strong>
              <p>{move.summary}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  )
}

function SettingsPanel({
  settings,
  onChange,
  onClose,
}: {
  settings: SettingsData
  onChange: <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => void
  onClose: () => void
}) {
  return (
    <div className="settings-overlay" role="dialog" aria-label="Settings">
      <div className="settings-panel">
        <div className="panel-title">
          <h3>Settings</h3>
          <button type="button" className="reset-button" onClick={onClose} aria-label="Close settings">X</button>
        </div>
        <label className="setting-row">
          <span>Animation Intensity</span>
          <select
            value={settings.animationIntensity}
            onChange={(e) => onChange('animationIntensity', e.target.value as SettingsData['animationIntensity'])}
          >
            <option value="full">Full</option>
            <option value="reduced">Reduced</option>
            <option value="none">None</option>
          </select>
        </label>
        <label className="setting-row">
          <span>Sound <small style={{ opacity: 0.5, fontWeight: 400 }}>(Coming Soon)</small></span>
          <input type="checkbox" checked={settings.soundEnabled} onChange={(e) => onChange('soundEnabled', e.target.checked)} disabled />
        </label>
        <label className="setting-row">
          <span>High Contrast</span>
          <input type="checkbox" checked={settings.highContrast} onChange={(e) => onChange('highContrast', e.target.checked)} />
        </label>
      </div>
    </div>
  )
}

function OfflineBanner() {
  return (
    <div className="offline-banner" role="alert">
      <strong>Offline</strong>
      <span>Live turns are unavailable. The demo still works locally.</span>
    </div>
  )
}

function StorageWarningBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="storage-warning" role="alert">
      <span>{message}</span>
      <button type="button" className="reset-button" onClick={onDismiss} aria-label="Dismiss warning">X</button>
    </div>
  )
}

function CombatMeta({
  resolve,
  maxResolve,
  stance,
  statuses,
  accent,
  reverse,
}: {
  resolve: number
  maxResolve: number
  stance: string
  statuses: StatusEffect[]
  accent: string
  reverse: boolean
}) {
  const percentage = Math.max(0, (resolve / maxResolve) * 100)

  return (
    <div className={`combat-meta ${reverse ? 'reverse' : ''}`}>
      <div className="vitality">
        <div className="vitality-meta">
          <span className="hud-label">RESOLVE</span>
          <span className="hud-value">{resolve} / {maxResolve}</span>
        </div>
        <div className="vitality-track" role="progressbar">
          <div
            className="vitality-fill-led"
            style={{ width: `${percentage}%`, backgroundColor: accent, boxShadow: `0 0 10px ${accent}66` }}
          />
        </div>
      </div>
      <div className="status-container">
        <div className="stance-badge">STANCE // {stance.toUpperCase()}</div>
        <div className="status-chips">
          {statuses.map((status) => (
            <span key={`${status.id}-${status.source}`} className="status-chip" title={getStatusMeta(status.id).description}>
              {getStatusMeta(status.id).label.toUpperCase()}
            </span>
          ))}
          {statuses.length === 0 && <span className="status-chip-empty">NO STATUS</span>}
        </div>
      </div>
    </div>
  )
}

function PortraitCard({
  imageUrl,
  name,
  title,
  align,
}: {
  imageUrl: string
  name: string
  title: string
  align: 'left' | 'right'
}) {
  const [imgError, setImgError] = useState(false)

  return (
    <div className={`portrait-recessed ${align}`}>
      <div className="portrait-inner">
        {imgError ? (
          <div className="portrait-fallback" aria-label={`Portrait of ${name}`}>
            <span>{name.slice(0, 2).toUpperCase()}</span>
          </div>
        ) : (
          <Image
            alt={`Portrait of ${name}`}
            src={imageUrl}
            fill
            sizes="350px"
            style={{ objectFit: 'cover', opacity: 0.8 }}
            loading="eager"
            onError={() => setImgError(true)}
          />
        )}
        <div className="portrait-overlay" />
      </div>
      <div className="portrait-data">
        <h2 className="hud-title">{name}</h2>
        <p className="hud-subtitle">{title}</p>
      </div>
    </div>
  )
}

function RailItem({
  label,
  href,
  active = false,
}: {
  label: string
  href: string
  active?: boolean
}) {
  return (
    <a className={active ? 'rail-item active' : 'rail-item'} href={href} aria-current={active ? 'true' : undefined}>
      <span aria-hidden="true">{label.slice(0, 1)}</span>
      <small>{label}</small>
    </a>
  )
}

function initialOracleLine(battle: BattleDefinition) {
  return `The chamber opens on ${battle.chapter}. ${battle.tutorialHint}`
}
