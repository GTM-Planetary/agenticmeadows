import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [showForgot, setShowForgot] = useState(false);

  // Check if any users exist — if not, redirect to onboarding wizard
  useEffect(() => {
    fetch("/api/auth/has-users")
      .then((r) => r.json())
      .then((data) => {
        if (!data.hasUsers) {
          navigate("/onboarding", { replace: true });
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Show nothing while checking for users (prevents flash)
  if (checking) {
    return (
      <div className="min-h-screen bg-turf-900 flex items-center justify-center">
        <div className="text-turf-400 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-am-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/am-icon.png" alt="AgenticMeadows" className="w-20 h-20 mx-auto mb-4 rounded-2xl" />
          <h1 className="text-2xl font-bold text-am-text-primary">AgenticMeadows</h1>
          <p className="text-am-green-mid text-sm mt-1">Landscaping Field Service Management</p>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 text-center">Sign In</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                autoComplete="email"
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                autoComplete="current-password"
                minLength={6}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
              {loading ? "Signing in..." : "Sign In"}
            </button>

            <button
              type="button"
              onClick={() => setShowForgot(!showForgot)}
              className="text-sm text-am-green-mid hover:underline w-full text-center mt-2"
            >
              Forgot your password?
            </button>

            {showForgot && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mt-2 text-sm text-amber-800">
                <p className="font-medium mb-2">Password Recovery</p>
                <p className="mb-2"><strong>Team members:</strong> Ask your admin to reset your password from Settings &rarr; Users &amp; Roles.</p>
                <p><strong>Admins:</strong> Run this from your install directory:</p>
                <code className="block bg-amber-100 rounded px-2 py-1 mt-1 text-xs font-mono">./reset-password.sh your@email.com</code>
              </div>
            )}
          </form>
        </div>

        <p className="text-am-green-mid text-xs text-center mt-4">
          100% local &middot; No cloud &middot; No subscriptions
        </p>
      </div>
    </div>
  );
}
