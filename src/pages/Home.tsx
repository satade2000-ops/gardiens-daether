import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { startGame, stopGame } from "@/game/boot";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import type { AetherGame } from "@/game/AetherGame";
import type { GameSnapshot } from "@/game/types";
const BEST_SCORE_KEY = "aether_best_score";
const REWARDS = [
  { name: "Bronze", score: 1000, icon: "🥉" },
  { name: "Argent", score: 5000, icon: "🥈" },
  { name: "Or", score: 10000, icon: "🥇" },
  { name: "Diamant", score: 20000, icon: "💎" },
];

function getBestScore(): number {
  try {
    return Number(localStorage.getItem(BEST_SCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}
const INITIAL: GameSnapshot = {
  state: "title", hp: 100, maxHp: 100, energy: 100, maxEnergy: 100, wave: 1,
  score: 0, combo: 1, shards: 0, kills: 0, elapsed: 0, enemies: 0,
  bossHp: 0, bossMaxHp: 0, choices: [], muted: false, fps: 60, drawCalls: 0,
  runId: 0, announcement: "", touch: false,
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function dispatch(name: string, detail: object): void {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function VirtualStick({ kind, label }: { kind: "move" | "aim"; label: string }) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef<number | null>(null);
  const base = useRef<HTMLDivElement>(null);
  const update = (clientX: number, clientY: number) => {
    const rect = base.current?.getBoundingClientRect();
    if (!rect) return;
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const radius = 42, len = Math.hypot(dx, dy);
    if (len > radius) { dx *= radius / len; dy *= radius / len; }
    setKnob({ x: dx, y: dy });
    if (kind === "move") dispatch("aether-move", { x: dx / radius, z: -dy / radius });
    else dispatch("aether-aim", { x: dx / radius, z: dy / radius, firing: len > 10 });
  };
  const release = () => {
    active.current = null; setKnob({ x: 0, y: 0 });
    if (kind === "move") dispatch("aether-move", { x: 0, z: 0 });
    else dispatch("aether-aim", { x: 0, z: 0, firing: false });
  };
  return (
    
    <div className={`virtual-stick ${kind}`} ref={base}
      onPointerDown={(e) => { e.preventDefault(); active.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); update(e.clientX, e.clientY); }}
      onPointerMove={(e) => { if (active.current === e.pointerId) update(e.clientX, e.clientY); }}
      onPointerUp={release} onPointerCancel={release}>
      <span className="stick-label">{label}</span>
      <div className="stick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<AetherGame | null>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot>(INITIAL);
  const [bestScore, setBestScore] = useState<number>(getBestScore);
  const [rewardNotification, setRewardNotification] = useState<string | null>(null);
const previousRewards = useRef<string[]>(
  REWARDS.filter((reward) => getBestScore() >= reward.score)
    .map((reward) => reward.name)
);
  const unlockedRewards = REWARDS.filter(
  (reward) => bestScore >= reward.score
);

const nextReward = REWARDS.find();
  useEffect(() => {
  const newlyUnlocked = unlockedRewards.filter(
    (reward) => !previousRewards.current.includes(reward.name)
  );

  if (newlyUnlocked.length > 0) {
    setRewardNotification(
      `${newlyUnlocked[0].icon} Félicitations ! Trophée ${newlyUnlocked[0].name} débloqué !`
    );

    previousRewards.current = unlockedRewards.map(
      (reward) => reward.name
    );
  }
}, [bestScore]);
  (reward) => bestScore < reward.score
);
  
  const game = gameRef.current;
  const auth = useAuth();
  const utils = trpc.useUtils();
  const leaderboard = trpc.game.leaderboard.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const profile = trpc.game.profile.useQuery(undefined, { enabled: auth.isAuthenticated, retry: false });
  const submittedRun = useRef(0);
  const submitRun = trpc.game.submitRun.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.game.leaderboard.invalidate(), utils.game.profile.invalidate()]);
    },
  });

  useEffect(() => {
    if (!snapshot.state || !["victory", "gameover"].includes(snapshot.state)) return;
    if (!auth.isAuthenticated || submittedRun.current === snapshot.runId || snapshot.runId === 0) return;
    submittedRun.current = snapshot.runId;
    submitRun.mutate({
      score: snapshot.score, wave: snapshot.wave, kills: snapshot.kills,
      durationMs: Math.max(1000, Math.round(snapshot.elapsed * 1000)),
      shards: snapshot.shards, victory: snapshot.state === "victory",
    });
  }, [snapshot.state, snapshot.runId, auth.isAuthenticated]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    gameRef.current = startGame(canvas, setSnapshot);
    return () => { stopGame(); gameRef.current = null; };
  }, []);
useEffect(() => {
  if (!["victory", "gameover"].includes(snapshot.state)) return;

  setBestScore((previous) => {
    const best = Math.max(previous, snapshot.score);

    try {
      localStorage.setItem(BEST_SCORE_KEY, String(best));
    } catch {
      // La sauvegarde locale peut être indisponible.
    }

    return best;
  });
}, [snapshot.state, snapshot.score]);
  const playing = snapshot.state === "playing";
  return (
    <div id="game-root" className={`state-${snapshot.state}`}>
      <canvas id="game-canvas" ref={canvasRef} aria-label="Les Gardiens d’Aether, jeu d’action 3D" />
      <div id="ui-overlay">
        {rewardNotification && (
  <div className="reward-notification">
    {rewardNotification}
  </div>
)}
        {(snapshot.state === "title" || snapshot.state === "victory" || snapshot.state === "gameover") && <div className="account-bar">
          {auth.isLoading ? <span>Connexion…</span> : auth.user ? <>
            <span className="account-dot" />
            <span><small>GARDIEN CONNECTÉ</small><b>{auth.user.name || "Gardien"}</b></span>
            {profile.data && <em>Record · {profile.data.bestScore.toLocaleString("fr-FR")}</em>}
            <button onClick={auth.logout} title="Se déconnecter">↪</button>
          </> : <Link to="/login">Se connecter avec Kimi <span>→</span></Link>}
        </div>}
        {playing && <>
          <section className="hud-left" aria-label="État du gardien">
            <div className="hud-brand"><span>✦</span> GARDIEN 07</div>
            <div className="bar-row"><span>PV</span><div className="meter"><i className="health" style={{ width: `${100 * snapshot.hp / snapshot.maxHp}%` }} /></div><b>{snapshot.hp}</b></div>
            <div className="bar-row"><span>FLUX</span><div className="meter"><i className="energy" style={{ width: `${snapshot.energy}%` }} /></div><b>{snapshot.energy}</b></div>
            <div className="shard-count">◇ {snapshot.shards} éclats</div>
          </section>
          <section className="hud-center">
            <p>VAGUE {snapshot.wave}<span>/4</span></p>
            <small>{snapshot.enemies} menaces restantes</small>
          </section>
          <section className="hud-right">
            <div className="score-label">SCORE</div>
            <strong>{snapshot.score.toLocaleString("fr-FR")}</strong>
            {snapshot.combo > 1 && <span className="combo">COMBO ×{snapshot.combo}</span>}
            <div className="hud-buttons">
              <button onClick={() => game?.toggleMute()} aria-label={snapshot.muted ? "Activer le son" : "Couper le son"}>{snapshot.muted ? "🔇" : "♪"}</button>
              <button onClick={() => game?.pause()} aria-label="Mettre en pause">Ⅱ</button>
            </div>
          </section>
          {snapshot.bossMaxHp > 0 && <div className="boss-meter"><span>GARDIEN CORROMPU</span><div><i style={{ width: `${100 * snapshot.bossHp / snapshot.bossMaxHp}%` }} /></div></div>}
          {snapshot.announcement && <div className="announcement">{snapshot.announcement}</div>}
          {!snapshot.touch && <div className="combat-hints"><span>WASD · se déplacer</span><span>Souris · viser & tirer</span><span>ESPACE · dash</span><span>E · impulsion</span></div>}
        </>}

        {playing && snapshot.touch && <div className="touch-controls">
          <VirtualStick kind="move" label="BOUGER" />
          <div className="touch-actions">
            <button onPointerDown={() => dispatch("aether-action", { action: "pulse" })}>◎<small>IMPULSION</small></button>
            <button onPointerDown={() => dispatch("aether-action", { action: "dash" })}>➜<small>DASH</small></button>
          </div>
          <VirtualStick kind="aim" label="VISER / TIRER" />
        </div>}

        {snapshot.state === "title" && <main className="menu-screen title-screen">
          <section className="title-copy">
            <div className="title-rune">✦</div>
            <p className="eyebrow">UNE AVENTURE DES CIEUX</p>
            <h1>LES GARDIENS<br /><em>D’AETHER</em></h1>
            <p className="title-description">Défends le sanctuaire suspendu. Maîtrise le flux, brise la corruption et libère l’île en quatre vagues.</p>
            <button className="primary-button play-button" onClick={() => game?.start()}>Entrer dans le sanctuaire <span>→</span></button>
            {bestScore > 0 && (
  <p className="personal-record">
    🏆 Ton meilleur score : <strong>{bestScore.toLocaleString("fr-FR")}</strong>
  </p>
)}
           <div className="rewards-panel">
  <h3>🏆 MES RÉCOMPENSES</h3>

  {unlockedRewards.length === 0 && (
    <p>Aucune récompense débloquée. Continue à jouer !</p>
  )}

  {unlockedRewards.map((reward) => (
    <p key={reward.name}>
      {reward.icon} {reward.name} — Débloqué !
    </p>
  ))}

  {nextReward ? (
    <p>
      Prochain objectif : {nextReward.icon} {nextReward.name}
      ({nextReward.score.toLocaleString("fr-FR")} points)
    </p>
  ) : (
    <p>💎 Toutes les récompenses sont débloquées !</p>
  )}
</div>
            <small className="keyboard-start">ou appuie sur ESPACE</small>
          </section>
          <div className="title-sidebar">
          <aside className="mission-card">
            <p className="eyebrow">MISSION 01 · L’ÎLE DE VERDANT</p>
            <h2>La faille s’ouvre.</h2>
            <div className="mission-steps">
              <div><b>01</b><span><strong>Repousse 3 vagues</strong>Chaque ennemi exige une tactique différente.</span></div>
              <div><b>02</b><span><strong>Collecte les éclats</strong>Recharge ton flux et achète des améliorations.</span></div>
              <div><b>03</b><span><strong>Affronte le Gardien</strong>Esquive les salves et utilise ton impulsion.</span></div>
            </div>
            <div className="controls-grid">
              <span><kbd>WASD</kbd> Mouvement</span><span><kbd>SOURIS</kbd> Tir</span>
              <span><kbd>ESPACE</kbd> Dash</span><span><kbd>E</kbd> Impulsion</span>
            </div>
            <p className="touch-note">Commandes tactiles doubles incluses sur mobile.</p>
          </aside>
          <section className="leaderboard-card">
            <div className="leaderboard-title"><span>CLASSEMENT MONDIAL</span><small>TOP 5</small></div>
            {leaderboard.isLoading ? <p className="leaderboard-empty">Chargement des scores…</p> : leaderboard.isError ? <p className="leaderboard-empty">Classement momentanément indisponible.</p> : leaderboard.data?.length ? <ol>
              {leaderboard.data.slice(0, 5).map((entry, index) => <li key={`${entry.name}-${index}`}><b>{index + 1}</b><span>{entry.name || "Gardien anonyme"}<small>{entry.wins} victoire{entry.wins > 1 ? "s" : ""}</small></span><strong>{entry.bestScore.toLocaleString("fr-FR")}</strong></li>)}
            </ol> : <p className="leaderboard-empty">Le premier record est à toi.</p>}
          </section>
          </div>
        </main>}

        {snapshot.state === "upgrade" && <main className="menu-screen modal-screen">
          <section className="upgrade-panel">
            <p className="eyebrow">VAGUE {snapshot.wave} TERMINÉE</p>
            <h2>Choisis ton amélioration</h2>
            <p>Tu possèdes <strong>◇ {snapshot.shards} éclats</strong>. La prochaine vague commence après ton choix.</p>
            <div className="upgrade-grid">
              {snapshot.choices.map((choice, index) => <button key={choice.id} disabled={choice.cost > snapshot.shards} onClick={() => game?.chooseUpgrade(index)}>
                <span className="upgrade-icon">{choice.icon}</span><small>CHOIX {index + 1}</small>
                <strong>{choice.name}</strong><p>{choice.description}</p>
                <b>{choice.cost === 0 ? "GRATUIT" : `◇ ${choice.cost}`}</b>
              </button>)}
            </div>
          </section>
        </main>}

        {snapshot.state === "paused" && <main className="menu-screen modal-screen">
          <section className="dialog-panel"><p className="eyebrow">FLUX SUSPENDU</p><h2>Pause</h2>
            <p>Le sanctuaire t’attend. Ton score actuel : <strong>{snapshot.score.toLocaleString("fr-FR")}</strong></p>
            <button className="primary-button" onClick={() => game?.resume()}>Reprendre</button>
            <button className="secondary-button" onClick={() => game?.restart()}>Recommencer la mission</button>
            <button className="text-button" onClick={() => game?.toTitle()}>Retour au titre</button>
          </section>
        </main>}

        {(snapshot.state === "victory" || snapshot.state === "gameover") && <main className="menu-screen modal-screen">
          <section className="dialog-panel result-panel">
            <div className={`result-emblem ${snapshot.state}`}>{snapshot.state === "victory" ? "✦" : "◇"}</div>
            <p className="eyebrow">{snapshot.state === "victory" ? "SANCTUAIRE PURIFIÉ" : "LE FLUX S’ÉTEINT"}</p>
            <h2>{snapshot.state === "victory" ? "Victoire, Gardien !" : "La corruption l’emporte"}</h2>
            <div className="result-score"><small>SCORE FINAL</small><strong>{snapshot.score.toLocaleString("fr-FR")}</strong></div>
            <div className="result-stats"><span><b>{snapshot.kills}</b> ennemis</span><span><b>{formatTime(snapshot.elapsed)}</b> durée</span><span><b>{snapshot.wave}/4</b> vague</span></div>
            <div className={`sync-status ${submitRun.isError ? "error" : ""}`}>
              {!auth.isAuthenticated ? <>Mode invité : ce score n’est pas classé. <Link to="/login">Se connecter</Link></> : submitRun.isPending ? "Enregistrement du score…" : submitRun.isSuccess ? "✓ Score et progression sauvegardés en ligne" : submitRun.isError ? "Synchronisation impossible pour le moment." : "Préparation de la sauvegarde…"}
            </div>
            <button className="primary-button" onClick={() => game?.restart()}>Rejouer la mission</button>
            <button className="text-button" onClick={() => game?.toTitle()}>Retour au titre</button>
          </section>
        </main>}
      </div>
    </div>
  );
}
