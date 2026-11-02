import { Link } from "react-router";

function getOAuthUrl() {
  const kimiAuthUrl = import.meta.env.VITE_KIMI_AUTH_URL;
  const appID = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${kimiAuthUrl}/api/oauth/authorize`);
  url.searchParams.set("client_id", appID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "profile");
  url.searchParams.set("state", state);

  return url.toString();
}

export default function Login() {
  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="brand-rune" aria-hidden="true">✦</div>
        <p className="eyebrow">LES GARDIENS D’AETHER</p>
        <h1 id="login-title">Rejoins la garde</h1>
        <p>Connecte-toi pour sauvegarder ta progression et inscrire tes scores au classement mondial.</p>
        <button className="primary-button" onClick={() => { window.location.href = getOAuthUrl(); }}>
          Se connecter avec Kimi
        </button>
        <Link className="text-link" to="/">Continuer en invité</Link>
      </section>
    </main>
  );
}
