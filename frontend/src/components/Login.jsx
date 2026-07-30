import { api } from "../api";

export default function Login() {
  return (
    <div className="login-screen">
      <div className="login-title">Rothko Cal</div>
      <div className="login-sub">Sign in with Google to view your week.</div>
      <a className="login-button" href={api.loginUrl}>Sign in with Google</a>
    </div>
  );
}
