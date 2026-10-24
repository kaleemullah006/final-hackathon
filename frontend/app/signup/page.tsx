
"use client";
import { useRouter } from "next/navigation";

import { useState } from "react";

export default function Home() {
    const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setSuccess(false);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        throw new Error("API URL is missing. Check your .env.local file.");
      }

      const response = await fetch(`${apiUrl}/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Signup failed. Please try again.");
      }
      
      setSuccess(true);
      setMessage(data.message || "Account created successfully!");
      setName("");
      setEmail("");
      setPassword("");
      if (response.ok) {
      router.push("/login");
    }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to connect to the backend."
      );
    } finally {
      setLoading(false);
    }
  };
  

  return (
    <main className="neon-page">
      <div className="ambient ambient-purple" aria-hidden="true" />
      <div className="ambient ambient-blue" aria-hidden="true" />
      <div className="background-grid" aria-hidden="true" />

      <div className="signup-layout">
        {/* LEFT: 3D SHOWCASE */}
        <section className="showcase-panel">
          <a className="brand" href="/" aria-label="Nexora home">
            <span className="brand-mark" aria-hidden="true">
              N<span>.</span>
            </span>
            <span className="brand-name">
              NEXORA<span className="brand-dot">/</span>
            </span>
          </a>

          <div className="showcase-copy">
            <div className="eyebrow">
              <span className="status-dot" />
              YOUR NEXT CHAPTER STARTS HERE
            </div>

            <h1>
              Think beyond.
              <br />
              <span className="neon-heading">Build the future.</span>
            </h1>

            <p className="showcase-description">
              One account. Endless possibilities. Step into a digital
              experience built around your next big idea.
            </p>
          </div>

          {/* CSS-only 3D illustration */}
          <div
            className="visual-stage"
            role="img"
            aria-label="Abstract glowing three-dimensional neon orb surrounded by orbital rings"
          >
            <div className="stage-halo" />

            <div className="orbit orbit-outer">
              <span className="orbit-satellite satellite-one" />
            </div>

            <div className="orbit orbit-middle">
              <span className="orbit-satellite satellite-two" />
            </div>

            <div className="orbit orbit-inner" />

            <div className="core-shadow" />

            <div className="neon-core">
              <div className="core-highlight" />
              <div className="core-line core-line-one" />
              <div className="core-line core-line-two" />
              <div className="core-center">N</div>
            </div>

            <div className="float-card float-card-top">
              <span className="float-icon">✦</span>
              <span>
                <strong>CREATE</strong>
                <small>Something extraordinary</small>
              </span>
            </div>

            <div className="float-card float-card-bottom">
              <span className="pulse-icon">
                <span />
              </span>
              <span>
                <strong>FUTURE READY</strong>
                <small>Your journey begins now</small>
              </span>
            </div>

            <div className="visual-cross cross-one">+</div>
            <div className="visual-cross cross-two">✳</div>
            <div className="visual-star star-one">✦</div>
            <div className="visual-star star-two">✧</div>
          </div>

          <div className="showcase-footer">
            <div className="footer-line" />
            <p>DESIGNED FOR WHAT COMES NEXT</p>
            <span>01 / 03</span>
          </div>
        </section>

        {/* RIGHT: SIGNUP FORM */}
        <section className="form-panel">
          <div className="form-topline">
            <span className="secure-label">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <rect
                  x="5"
                  y="10"
                  width="14"
                  height="11"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <path
                  d="M8 10V7a4 4 0 0 1 8 0v3"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
              </svg>
              SECURE REGISTRATION
            </span>
            <span className="step-label">STEP 01 — ACCOUNT</span>
          </div>

          <div className="form-heading">
            <div className="form-kicker">START YOUR JOURNEY</div>
            <h2>
              Create your
              <br />
              <span>account.</span>
            </h2>
            <p>Enter your details below to get started.</p>
          </div>

          <form className="neon-form" onSubmit={handleSignup}>
            <div className="field-group">
              <label htmlFor="signup-name">Full name</label>
              <div className="neon-input-wrap">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="12"
                    cy="8"
                    r="4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M4 21a8 8 0 0 1 16 0"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                <input
                  id="signup-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="John Carter"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="signup-email">Email address</label>
              <div className="neon-input-wrap">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    x="3"
                    y="5"
                    width="18"
                    height="14"
                    rx="3"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <path
                    d="m4 7 8 6 8-6"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <input
                  id="signup-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="field-group">
              <div className="label-row">
                <label htmlFor="signup-password">Password</label>
                <span>8+ CHARACTERS</span>
              </div>

              <div className="neon-input-wrap">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    x="4"
                    y="10"
                    width="16"
                    height="11"
                    rx="2.5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M8 10V7a4 4 0 0 1 8 0v3"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <circle cx="12" cy="15" r="1.2" fill="currentColor" />
                </svg>
                <input
                  id="signup-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? "HIDE" : "SHOW"}
                </button>
              </div>
            </div>

            <label className="terms-row">
              <input type="checkbox" required />
              <span>
                I agree to the <a href="/terms">Terms of Service</a> and{" "}
                <a href="/privacy">Privacy Policy</a>.
              </span>
            </label>

            <button className="neon-submit" type="submit" disabled={loading}>
              <span>{loading ? "CREATING YOUR ACCOUNT..." : "CREATE ACCOUNT"}</span>
              {!loading && <span className="submit-arrow">↗</span>}
              {loading && <span className="loading-spinner" />}
            </button>

            <p
              className={`form-message ${message ? "visible" : ""} ${
                success ? "message-success" : "message-error"
              }`}
              role="status"
              aria-live="polite"
            >
              {message}
            </p>
          </form>

          <div className="form-divider">
            <span />
            <p>YOUR NEXT CHAPTER AWAITS</p>
            <span />
          </div>

          <p className="signin-prompt">
            Already have an account?{" "}
            <a href="/login">Sign in <span aria-hidden="true">↗</span></a>
          </p>

          <div className="form-bottom">
            <span>© 2026 NEXORA</span>
            <span className="encryption-note">
              <span className="tiny-green-dot" />
              ENCRYPTED CONNECTION
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
