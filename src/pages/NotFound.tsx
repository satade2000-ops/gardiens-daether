import { Link } from "react-router";

export default function NotFound() {
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <p className="eyebrow">HORS DES SENTIERS D’AETHER</p>
        <h1>404</h1>
        <p>Cette île n’existe pas encore.</p>
        <Link className="primary-button" to="/">Retour au sanctuaire</Link>
      </section>
    </main>
  );
}
