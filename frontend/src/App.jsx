import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "ai-tutor-screener-auth";
const BASE_API = "/api";
const MIN_INTERVIEW_MINUTES = 5;
const MAX_INTERVIEW_MINUTES = 10;
const MAX_QUESTION_COUNT = 6;

const STAGES = [
  { id: "welcome", label: "Welcome" },
  { id: "icebreaker", label: "About You" },
  { id: "scenario1", label: "Teaching" },
  { id: "scenario2", label: "Challenge" },
  { id: "wrap", label: "Wrap Up" },
];

const SCORE_DIMENSIONS = [
  { key: "communicationClarity", label: "Clarity", icon: "C" },
  { key: "warmth", label: "Warmth", icon: "W" },
  { key: "patience", label: "Patience", icon: "P" },
  { key: "abilityToSimplify", label: "Simplicity", icon: "S" },
  { key: "englishFluency", label: "Fluency", icon: "F" },
];

const PORTAL_COPY = {
  interviewee: {
    eyebrow: "CANDIDATE ENTRY",
    title: "TUTOR SCREEN",
    note: "Use this portal to take the AI screening interview and generate your final report.",
  },
  recruiter: {
    eyebrow: "RECRUITER ACCESS",
    title: "HIRING DESK",
    note: "Use this portal to review completed screenings, compare outcomes, and read transcripts.",
  },
};

async function apiRequest(path, method = "GET", body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || response.statusText || "Request failed");
  }

  return payload;
}

function normalizeScores(scores = {}) {
  const getScoreValue = (value, fallbackKey) => {
    if (typeof value === "number") {
      return value;
    }

    if (value && typeof value === "object" && typeof value.score !== "undefined") {
      return Number(value.score || 0);
    }

    return Number(fallbackKey || 0);
  };

  return {
    communicationClarity: getScoreValue(scores.communicationClarity, scores["Communication Clarity"]),
    warmth: getScoreValue(scores.warmth, scores.Warmth),
    patience: getScoreValue(scores.patience, scores.Patience),
    abilityToSimplify: getScoreValue(scores.abilityToSimplify, scores["Ability to Simplify"]),
    englishFluency: getScoreValue(scores.englishFluency, scores["English Fluency"]),
  };
}

function normalizeEvaluation(evaluation = {}) {
  const recommendation = String(evaluation.recommendation || evaluation.verdict || "hold").toLowerCase();
  const quotes = Array.isArray(evaluation.evidenceQuotes)
    ? evaluation.evidenceQuotes
    : Array.isArray(evaluation.quotes)
      ? evaluation.quotes.map((quote) => ({ quote, dimension: "general", positive: true }))
      : [];

  const scoreMap = normalizeScores(evaluation.scores);

  return {
    recommendation,
    verdictReason: evaluation.reasoning || evaluation.verdictReason || "Gemini returned an incomplete evaluation.",
    overallSummary: evaluation.overallSummary || evaluation.reasoning || "Interview analyzed successfully.",
    scores: {
      communicationClarity: {
        score: scoreMap.communicationClarity,
        reasoning: evaluation.scores?.communicationClarity?.reasoning || evaluation.scores?.["Communication Clarity"]?.reasoning || "",
      },
      warmth: {
        score: scoreMap.warmth,
        reasoning: evaluation.scores?.warmth?.reasoning || evaluation.scores?.Warmth?.reasoning || "",
      },
      patience: {
        score: scoreMap.patience,
        reasoning: evaluation.scores?.patience?.reasoning || evaluation.scores?.Patience?.reasoning || "",
      },
      abilityToSimplify: {
        score: scoreMap.abilityToSimplify,
        reasoning: evaluation.scores?.abilityToSimplify?.reasoning || evaluation.scores?.["Ability to Simplify"]?.reasoning || "",
      },
      englishFluency: {
        score: scoreMap.englishFluency,
        reasoning: evaluation.scores?.englishFluency?.reasoning || evaluation.scores?.["English Fluency"]?.reasoning || "",
      },
    },
    evidenceQuotes: quotes,
    strengths: Array.isArray(evaluation.strengths) ? evaluation.strengths : [],
    concerns: Array.isArray(evaluation.concerns)
      ? evaluation.concerns
      : Array.isArray(evaluation.weaknesses)
        ? evaluation.weaknesses
        : [],
  };
}

function normalizeStoredUser(user = {}) {
  return {
    ...user,
    role: user.role === "recruiter" ? "recruiter" : "interviewee",
  };
}

function Waveform({ active, color = "var(--accent)" }) {
  return (
    <div className="waveform" aria-hidden="true">
      {Array.from({ length: 24 }).map((_, index) => (
        <span
          key={index}
          className={`wave-bar ${active ? "is-active" : ""}`}
          style={{
            background: color,
            animationDelay: `${(index * 0.05).toFixed(2)}s`,
          }}
        />
      ))}
    </div>
  );
}

function ScoreRing({ score, max = 5 }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, score / max));
  const dash = circumference * progress;
  const color = score >= 4 ? "var(--good)" : score >= 3 ? "var(--accent)" : "var(--danger)";

  return (
    <svg width="74" height="74" viewBox="0 0 74 74" className="score-ring" aria-hidden="true">
      <circle cx="37" cy="37" r={radius} className="score-ring-track" />
      <circle
        cx="37"
        cy="37"
        r={radius}
        className="score-ring-fill"
        style={{
          stroke: color,
          strokeDasharray: `${dash} ${circumference}`,
        }}
      />
      <text x="37" y="41" textAnchor="middle" className="score-ring-text">
        {score}/5
      </text>
    </svg>
  );
}

function ScreenShell({ children, interview = false }) {
  return (
    <div className={`theme-shell ${interview ? "theme-shell-interview" : ""}`}>
      <div className="theme-grid" />
      <div className="theme-glow theme-glow-large" />
      <div className="theme-glow theme-glow-small" />
      <div className="theme-scanline" />
      <div className="theme-content">{children}</div>
    </div>
  );
}

function PortalSelectScreen({ onSelectPortal }) {
  return (
    <ScreenShell>
      <div className="center-wrap">
        <section className="hero-panel portal-panel">
          <div className="eyebrow-badge">START HERE</div>
          <h1 className="hero-title">
            CUEMATH
            <br />
            <span>ACCESS</span>
            <br />
            POINT
          </h1>

          <p className="hero-copy">
            Choose the right login path before entering the platform. Recruiters review reports. Interviewees take the screening.
          </p>

          <div className="portal-grid">
            <button type="button" className="portal-card" onClick={() => onSelectPortal("recruiter")}>
              <div className="portal-kicker">RECRUITER</div>
              <h2>Review dashboards, scores, and transcripts</h2>
              <p>Open the hiring dashboard to monitor completed interviews and make faster shortlist decisions.</p>
            </button>

            <button type="button" className="portal-card portal-card-candidate" onClick={() => onSelectPortal("interviewee")}>
              <div className="portal-kicker">INTERVIEWEE</div>
              <h2>Enter the tutor screening experience</h2>
              <p>Sign in to take the AI-led interview, speak your answers, and receive a saved evaluation report.</p>
            </button>
          </div>
        </section>
      </div>
    </ScreenShell>
  );
}

function AuthScreen({ portal, onAuth, onBack }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const portalCopy = PORTAL_COPY[portal];

  const canSubmit = email.trim() && password.trim() && (mode === "login" || name.trim());

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError("");

    try {
      const route = mode === "login" ? "/auth/login" : "/auth/register";
      const body = { email: email.trim(), password: password.trim(), role: portal };
      if (mode === "register") {
        body.name = name.trim();
      }

      const { user, token } = await apiRequest(route, "POST", body);
      onAuth(user, token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenShell>
      <div className="center-wrap">
        <section className="hero-panel">
          <div className="eyebrow-badge">{portalCopy.eyebrow}</div>
          <h1 className="hero-title">
            CUEMATH
            <br />
            <span>{portalCopy.title.split(" ")[0]}</span>
            <br />
            {portalCopy.title.split(" ").slice(1).join(" ")}
          </h1>

          <div className="section-divider">
            <span>{portal === "recruiter" ? "RECRUITER LOGIN" : "CANDIDATE LOGIN"}</span>
          </div>

          <p className="subtle-note">{portalCopy.note}</p>

          <div className="tab-row">
            <button
              type="button"
              className={`tab-button ${mode === "login" ? "is-active" : ""}`}
              onClick={() => setMode("login")}
            >
              Login
            </button>
            <button
              type="button"
              className={`tab-button ${mode === "register" ? "is-active" : ""}`}
              onClick={() => setMode("register")}
            >
              Register
            </button>
          </div>

          <form className="theme-form" onSubmit={handleSubmit}>
            {mode === "register" && (
              <label className="theme-field">
                <span>{portal === "recruiter" ? "Recruiter Name" : "Full Name"}</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riya Sharma" />
              </label>
            )}

            <label className="theme-field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>

            <label className="theme-field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="........"
              />
            </label>

            {error && <p className="status-error">{error}</p>}

            <div className="action-row">
              <button className="primary-cta" type="submit" disabled={!canSubmit || loading}>
                {loading ? "WORKING..." : mode === "login" ? "ENTER" : "CREATE ACCESS"}
              </button>
              <button className="ghost-cta" type="button" onClick={onBack} disabled={loading}>
                SWITCH PORTAL
              </button>
            </div>
          </form>
        </section>
      </div>
    </ScreenShell>
  );
}

function WelcomeScreen({ user, onStart, onLogout }) {
  return (
    <ScreenShell>
      <div className="center-wrap">
        <section className="hero-panel">
          <div className="eyebrow-badge">READY</div>
          <h1 className="hero-title hero-title-small">
            HI, <span>{user.name.toUpperCase()}</span>
          </h1>
          <p className="hero-copy">
            Start an adaptive tutor screening, collect the transcript, and save the report to MongoDB.
          </p>

          <div className="account-card">
            <div>
              <span className="mini-label">Name</span>
              <strong>{user.name}</strong>
            </div>
            <div>
              <span className="mini-label">Email</span>
              <strong>{user.email}</strong>
            </div>
            <div>
              <span className="mini-label">Role</span>
              <strong>{user.role}</strong>
            </div>
          </div>

          <div className="action-row">
            <button className="primary-cta" type="button" onClick={onStart}>
              START INTERVIEW
            </button>
            <button className="ghost-cta" type="button" onClick={onLogout}>
              LOG OUT
            </button>
          </div>
        </section>
      </div>
    </ScreenShell>
  );
}

function InterviewScreen({ user, token, onComplete, onCancel }) {
  const [messages, setMessages] = useState([]);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [micReady, setMicReady] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [speechHint, setSpeechHint] = useState("Speak naturally. You can lightly edit the transcript if the browser mishears you.");
  const [startedAt] = useState(Date.now());
  const [hasAutoFinished, setHasAutoFinished] = useState(false);
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef("");
  const chatScrollRef = useRef(null);

  function speakAssistantMessage(text) {
    if (!voiceEnabled || typeof window === "undefined" || !window.speechSynthesis || !text) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.97;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }

  useEffect(() => {
    if (!voiceEnabled && typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, [voiceEnabled]);

  useEffect(() => {
    let active = true;

    async function beginInterview() {
      try {
        const response = await apiRequest(
          "/chat",
          "POST",
          { message: `Begin the interview for candidate ${user.name}.`, history: [] },
          token
        );

        if (!active) return;
        setMessages([{ role: "assistant", text: response.reply }]);
        speakAssistantMessage(response.reply);
      } catch (err) {
        if (!active) return;
        setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    beginInterview();
    return () => {
      active = false;
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [token, user.name]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return undefined;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript || "";
        if (event.results[index].isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }

      if (finalText) {
        finalTranscriptRef.current = `${finalTranscriptRef.current} ${finalText}`.trim();
      }

      const nextText = `${finalTranscriptRef.current} ${interimText}`.trim();
      setLiveText(nextText);
      setAnswer(nextText);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setSpeechHint("The microphone had trouble hearing you. Try again, or quickly fix the transcript below.");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setMicReady(true);

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  const stageIdx = useMemo(() => {
    const assistantTurns = messages.filter((message) => message.role === "assistant").length;
    return Math.max(0, Math.min(STAGES.length - 1, assistantTurns - 1));
  }, [messages]);

  const assistantTurns = useMemo(
    () => messages.filter((message) => message.role === "assistant").length,
    [messages]
  );
  const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
  const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
  const seconds = String(elapsedSeconds % 60).padStart(2, "0");

  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;

    container.scrollTop = container.scrollHeight;
  }, [messages, liveText]);

  useEffect(() => {
    if (hasAutoFinished || sending || loading || assistantTurns < MAX_QUESTION_COUNT) {
      return;
    }

    setHasAutoFinished(true);
    handleFinish();
  }, [assistantTurns, hasAutoFinished, loading, sending]);

  async function handleSend(event) {
    event.preventDefault();
    if (!answer.trim() || sending) return;

    const userMessage = answer.trim();
    const nextMessages = [...messages, { role: "candidate", text: userMessage }];
    const history = nextMessages.map((entry) => ({
      role: entry.role === "assistant" ? "assistant" : "user",
      content: entry.text,
    }));

    setMessages(nextMessages);
    setAnswer("");
    setSending(true);
    setError("");
    setLiveText("");
    setSpeechHint("Priya is thinking about your answer...");

    try {
      const response = await apiRequest("/chat", "POST", { message: userMessage, history }, token);
      setMessages((current) => [...current, { role: "assistant", text: response.reply }]);
      speakAssistantMessage(response.reply);
      setSpeechHint("Speak your next answer when you're ready.");
    } catch (err) {
      setError(err.message);
      setSpeechHint("Something interrupted the flow. You can retry the mic or adjust the transcript manually.");
    } finally {
      setSending(false);
    }
  }

  function startListening() {
    if (!micReady || loading || sending || isListening) return;
    finalTranscriptRef.current = answer.trim();
    setLiveText(answer.trim());
    setError("");
    setSpeechHint("Listening now. Answer like you would speak to a real student.");

    try {
      recognitionRef.current?.start();
      setIsListening(true);
    } catch {
      setError("Speech recognition could not start. Please try again.");
      setSpeechHint("Browser mic access was blocked. Check microphone permission and try again.");
    }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
    setSpeechHint("Transcript captured. Review it quickly, then send.");
  }

  function handleFinish() {
    if (messages.length < 2) return;

    const transcript = messages
      .map((message) => `${message.role === "assistant" ? "Priya" : user.name}: ${message.text}`)
      .join("\n");

    onComplete(transcript);
  }

  return (
    <ScreenShell interview>
      <div className="interview-layout">
        <header className="interview-topbar">
          <div className="topbar-brand">
            <span className="live-dot" />
            <span className="brand-mark">CUEMATH</span>
            <span className="brand-slash">/ INTERVIEW</span>
          </div>

          <div className="stage-row">
            {STAGES.map((stage, index) => (
              <span
                key={stage.id}
                className={`stage-pill ${index === stageIdx ? "is-active" : ""} ${index < stageIdx ? "is-complete" : ""}`}
              >
                {stage.label.toUpperCase()}
              </span>
            ))}
          </div>

          <div className="topbar-actions">
            <span className="timer">
              {minutes}:{seconds}
            </span>
            <button
              className="ghost-cta compact"
              type="button"
              onClick={() => setVoiceEnabled((current) => !current)}
            >
              {voiceEnabled ? "VOICE ON" : "VOICE OFF"}
            </button>
            <button className="ghost-cta compact" type="button" onClick={handleFinish} disabled={loading || sending || messages.length < 2}>
              END
            </button>
          </div>
        </header>

        <div className="interview-body">
          <aside className="interview-sidebar">
            <div className="avatar-panel">
              <div className={`avatar-orb ${sending ? "is-speaking" : ""}`}>P</div>
              <div className="avatar-name">Priya</div>
              <div className="avatar-meta">TALENT TEAM</div>
            </div>

            <div className="panel-block">
              <div className="mini-label">SCREENING WINDOW</div>
              <div className="status-line">{MIN_INTERVIEW_MINUTES}-{MAX_INTERVIEW_MINUTES} MINUTES</div>
            </div>

            <div className="panel-block">
              <div className="mini-label">AI SPEAKING</div>
              <Waveform active={sending || loading} />
            </div>

            <div className="status-line">
              {loading ? "WELCOME TO THE SCREENING..." : sending ? "PRIYA IS REPLYING..." : "READY FOR YOUR NEXT ANSWER"}
            </div>

            <div className="panel-block sidebar-bottom">
              <div className="mini-label">VOICE-FIRST INPUT</div>
              <Waveform active={isListening} color="var(--muted-accent)" />
            </div>
          </aside>

          <section className="chat-panel">
            <div className="chat-scroll" ref={chatScrollRef}>
              {messages.length === 0 && (
                <div className="empty-state">Waiting for Priya...</div>
              )}

              <article className="bubble-row">
                <div className="bubble-avatar">P</div>
                <div className="bubble-stack">
                  <div className="bubble-label">SCREENING INFO</div>
                  <div className="bubble-card">
                    Welcome to the screening. This conversation adapts to each answer, focuses on real tutoring judgment, and usually finishes in {MIN_INTERVIEW_MINUTES}-{MAX_INTERVIEW_MINUTES} minutes.
                  </div>
                </div>
              </article>

              {messages.map((message, index) => (
                <article
                  key={`${message.role}-${index}`}
                  className={`bubble-row ${message.role === "candidate" ? "is-candidate" : ""}`}
                >
                  <div className={`bubble-avatar ${message.role === "candidate" ? "is-candidate" : ""}`}>
                    {message.role === "assistant" ? "P" : user.name[0]?.toUpperCase()}
                  </div>
                  <div className="bubble-stack">
                    <div className="bubble-label">
                      {message.role === "assistant" ? "PRIYA" : user.name.toUpperCase()}
                    </div>
                    <div className={`bubble-card ${message.role === "candidate" ? "is-candidate" : ""}`}>
                      {message.text}
                    </div>
                  </div>
                </article>
              ))}

              {error && <p className="status-error">{error}</p>}
            </div>

            <form className="composer" onSubmit={handleSend}>
              {liveText && (
                <div className="live-caption">
                  <span className="live-caption-dot" />
                  <span>{liveText}</span>
                </div>
              )}

              <p className="subtle-note">{speechHint}</p>

              <label className="theme-field composer-field">
                <span>Live Transcript</span>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Your spoken answer will appear here. Use typing only to fix missed words if needed."
                  disabled={loading || sending}
                  rows={4}
                />
              </label>

              <div className="composer-actions">
                <button
                  className={`ghost-cta mic-button ${isListening ? "is-recording" : ""}`}
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  disabled={!micReady || loading || sending}
                >
                  {!micReady ? "MIC UNAVAILABLE" : isListening ? "STOP RECORDING" : "START VOICE INPUT"}
                </button>
                <button className="primary-cta" type="submit" disabled={loading || sending || !answer.trim()}>
                  {sending ? "PROCESSING..." : "SEND REPLY"}
                </button>
                <button className="ghost-cta" type="button" onClick={onCancel}>
                  BACK
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </ScreenShell>
  );
}

function SavingScreen({ message }) {
  return (
    <ScreenShell>
      <div className="center-wrap">
        <section className="hero-panel compact-panel">
          <div className="spinner" />
          <div className="eyebrow-text">PLEASE WAIT</div>
          <h1 className="hero-title hero-title-small">{message}</h1>
          <p className="hero-copy">The full screening is being evaluated and the backend is saving the session.</p>
        </section>
      </div>
    </ScreenShell>
  );
}

function ReportScreen({ user, report, transcript, onRestart, onLogout }) {
  const verdictColor = {
    proceed: "var(--good)",
    hold: "var(--accent)",
    reject: "var(--danger)",
  };

  return (
    <ScreenShell>
      <div className="report-shell">
        <header className="report-header">
          <div>
            <div className="eyebrow-text">ASSESSMENT REPORT</div>
            <h1 className="report-title">{user.name.toUpperCase()}</h1>
            <p className="report-date">
              Cuemath Tutor Screening ·{" "}
              {new Date().toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          <div
            className="verdict-badge"
            style={{
              color: verdictColor[report.recommendation] || "var(--accent)",
              borderColor: verdictColor[report.recommendation] || "var(--accent)",
            }}
          >
            {report.recommendation === "proceed"
              ? "PROCEED"
              : report.recommendation === "reject"
                ? "REJECT"
                : "HOLD"}
          </div>
        </header>

        <div className="report-actions">
          <button className="ghost-cta" type="button" onClick={onRestart}>
            NEW INTERVIEW
          </button>
          <button className="ghost-cta" type="button" onClick={onLogout}>
            LOG OUT
          </button>
        </div>

        <section className="report-section">
          <div className="section-title">OVERALL SUMMARY</div>
          <p className="summary-copy">{report.overallSummary}</p>
          <p className="summary-subcopy">{report.verdictReason}</p>
        </section>

        <section className="report-section">
          <div className="section-title">DIMENSION SCORES</div>
          <div className="score-grid-theme">
            {SCORE_DIMENSIONS.map((dimension) => {
              const entry = report.scores?.[dimension.key] || { score: 0, reasoning: "" };

              return (
                <article key={dimension.key} className="score-card-theme">
                  <div className="score-label">
                    {dimension.icon} {dimension.label.toUpperCase()}
                  </div>
                  <ScoreRing score={entry.score} />
                  <p className="score-reasoning">{entry.reasoning}</p>
                </article>
              );
            })}
          </div>
        </section>

        {report.evidenceQuotes?.length > 0 && (
          <section className="report-section">
            <div className="section-title">EVIDENCE QUOTES</div>
            <div className="quote-list">
              {report.evidenceQuotes.map((quote, index) => (
                <article key={`${quote.quote}-${index}`} className="quote-card">
                  <p className="quote-text">"{quote.quote}"</p>
                  <div className={`quote-meta ${quote.positive ? "is-positive" : "is-negative"}`}>
                    {(quote.dimension || "general").toUpperCase()} · {quote.positive ? "STRENGTH" : "CONCERN"}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="report-duo">
          <article className="list-card">
            <div className="section-title">STRENGTHS</div>
            {report.strengths?.length ? (
              report.strengths.map((item, index) => (
                <div key={`${item}-${index}`} className="list-row is-positive">
                  <span>+</span>
                  <span>{item}</span>
                </div>
              ))
            ) : (
              <p className="empty-copy">No strengths were returned.</p>
            )}
          </article>

          <article className="list-card">
            <div className="section-title">CONCERNS</div>
            {report.concerns?.length ? (
              report.concerns.map((item, index) => (
                <div key={`${item}-${index}`} className="list-row is-negative">
                  <span>!</span>
                  <span>{item}</span>
                </div>
              ))
            ) : (
              <p className="empty-copy">No concerns were returned.</p>
            )}
          </article>
        </section>

        <section className="report-section transcript-card">
          <div className="section-title">TRANSCRIPT</div>
          <pre>{transcript}</pre>
        </section>
      </div>
    </ScreenShell>
  );
}

function RecruiterDashboard({ user, token, onLogout }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [interviews, setInterviews] = useState([]);
  const [selectedId, setSelectedId] = useState("");

  async function loadInterviews() {
    setLoading(true);
    setError("");

    try {
      const response = await apiRequest("/interviews", "GET", undefined, token);
      const nextInterviews = (response.interviews || []).map((interview) => ({
        ...interview,
        normalizedEvaluation: normalizeEvaluation(interview.evaluation),
      }));

      setInterviews(nextInterviews);
      setSelectedId((current) => {
        if (current && nextInterviews.some((interview) => interview._id === current)) {
          return current;
        }
        return nextInterviews[0]?._id || "";
      });
    } catch (err) {
      setError(err.message || "Unable to load interviews.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInterviews();
  }, [token]);

  const selectedInterview = useMemo(
    () => interviews.find((interview) => interview._id === selectedId) || interviews[0] || null,
    [interviews, selectedId]
  );

  const stats = useMemo(() => {
    return interviews.reduce(
      (acc, interview) => {
        const recommendation = interview.normalizedEvaluation.recommendation;
        acc.total += 1;
        if (recommendation === "proceed") acc.proceed += 1;
        if (recommendation === "hold") acc.hold += 1;
        if (recommendation === "reject") acc.reject += 1;
        return acc;
      },
      { total: 0, proceed: 0, hold: 0, reject: 0 }
    );
  }, [interviews]);

  return (
    <ScreenShell>
      <div className="dashboard-shell">
        <header className="dashboard-header">
          <div>
            <div className="eyebrow-text">RECRUITER DASHBOARD</div>
            <h1 className="report-title">HIRING DESK</h1>
            <p className="report-date">
              Signed in as {user.name} · {user.email}
            </p>
          </div>

          <div className="report-actions">
            <button className="ghost-cta" type="button" onClick={loadInterviews} disabled={loading}>
              REFRESH
            </button>
            <button className="ghost-cta" type="button" onClick={onLogout}>
              LOG OUT
            </button>
          </div>
        </header>

        <section className="dashboard-stats">
          <article className="stat-card">
            <span className="mini-label">TOTAL</span>
            <strong>{stats.total}</strong>
          </article>
          <article className="stat-card">
            <span className="mini-label">PROCEED</span>
            <strong>{stats.proceed}</strong>
          </article>
          <article className="stat-card">
            <span className="mini-label">HOLD</span>
            <strong>{stats.hold}</strong>
          </article>
          <article className="stat-card">
            <span className="mini-label">REJECT</span>
            <strong>{stats.reject}</strong>
          </article>
        </section>

        {error && <p className="status-error">{error}</p>}

        <div className="dashboard-grid">
          <aside className="dashboard-list">
            <div className="section-title">COMPLETED INTERVIEWS</div>
            {loading ? (
              <div className="status-line">LOADING INTERVIEWS...</div>
            ) : interviews.length === 0 ? (
              <div className="status-line">No saved interviews yet.</div>
            ) : (
              interviews.map((interview) => {
                const evaluation = interview.normalizedEvaluation;
                return (
                  <button
                    key={interview._id}
                    type="button"
                    className={`interview-list-card ${selectedInterview?._id === interview._id ? "is-active" : ""}`}
                    onClick={() => setSelectedId(interview._id)}
                  >
                    <div className="interview-list-top">
                      <strong>{interview.candidateName}</strong>
                      <span className={`recommendation-pill recommendation-${evaluation.recommendation}`}>
                        {evaluation.recommendation}
                      </span>
                    </div>
                    <p>{evaluation.overallSummary}</p>
                    <div className="interview-list-meta">
                      {new Date(interview.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </button>
                );
              })
            )}
          </aside>

          <section className="dashboard-detail">
            {!selectedInterview ? (
              <div className="status-line">Select an interview to view its report.</div>
            ) : (
              <>
                <header className="report-header">
                  <div>
                    <div className="eyebrow-text">CANDIDATE REPORT</div>
                    <h2 className="hero-title hero-title-small">{selectedInterview.candidateName.toUpperCase()}</h2>
                    <p className="report-date">
                      Saved{" "}
                      {new Date(selectedInterview.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  <div className={`verdict-badge verdict-${selectedInterview.normalizedEvaluation.recommendation}`}>
                    {selectedInterview.normalizedEvaluation.recommendation.toUpperCase()}
                  </div>
                </header>

                <section className="report-section">
                  <div className="section-title">SUMMARY</div>
                  <p className="summary-copy">{selectedInterview.normalizedEvaluation.overallSummary}</p>
                  <p className="summary-subcopy">{selectedInterview.normalizedEvaluation.verdictReason}</p>
                </section>

                <section className="report-section">
                  <div className="section-title">DIMENSION SCORES</div>
                  <div className="score-grid-theme">
                    {SCORE_DIMENSIONS.map((dimension) => {
                      const entry = selectedInterview.normalizedEvaluation.scores?.[dimension.key] || { score: 0, reasoning: "" };
                      return (
                        <article key={dimension.key} className="score-card-theme">
                          <div className="score-label">
                            {dimension.icon} {dimension.label.toUpperCase()}
                          </div>
                          <ScoreRing score={entry.score} />
                          <p className="score-reasoning">{entry.reasoning}</p>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="report-duo">
                  <article className="list-card">
                    <div className="section-title">STRENGTHS</div>
                    {selectedInterview.normalizedEvaluation.strengths?.length ? (
                      selectedInterview.normalizedEvaluation.strengths.map((item, index) => (
                        <div key={`${item}-${index}`} className="list-row is-positive">
                          <span>+</span>
                          <span>{item}</span>
                        </div>
                      ))
                    ) : (
                      <p className="empty-copy">No strengths were returned.</p>
                    )}
                  </article>

                  <article className="list-card">
                    <div className="section-title">CONCERNS</div>
                    {selectedInterview.normalizedEvaluation.concerns?.length ? (
                      selectedInterview.normalizedEvaluation.concerns.map((item, index) => (
                        <div key={`${item}-${index}`} className="list-row is-negative">
                          <span>!</span>
                          <span>{item}</span>
                        </div>
                      ))
                    ) : (
                      <p className="empty-copy">No concerns were returned.</p>
                    )}
                  </article>
                </section>

                <section className="report-section transcript-card">
                  <div className="section-title">TRANSCRIPT</div>
                  <pre>{selectedInterview.transcript}</pre>
                </section>
              </>
            )}
          </section>
        </div>
      </div>
    </ScreenShell>
  );
}

function ErrorScreen({ message, onRetry, onLogout }) {
  return (
    <ScreenShell>
      <div className="center-wrap">
        <section className="hero-panel compact-panel">
          <div className="eyebrow-text">ERROR</div>
          <h1 className="hero-title hero-title-small">SOMETHING WENT WRONG</h1>
          <p className="status-error">{message}</p>
          <div className="action-row">
            <button className="primary-cta" type="button" onClick={onRetry}>
              TRY AGAIN
            </button>
            <button className="ghost-cta" type="button" onClick={onLogout}>
              LOG OUT
            </button>
          </div>
        </section>
      </div>
    </ScreenShell>
  );
}

export default function App() {
  const [auth, setAuth] = useState({ user: null, token: "" });
  const [portal, setPortal] = useState("");
  const [screen, setScreen] = useState("portal");
  const [transcript, setTranscript] = useState("");
  const [report, setReport] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      if (parsed.user && parsed.token) {
        const user = normalizeStoredUser(parsed.user);
        setAuth({ user, token: parsed.token });
        setPortal(user.role);
        setScreen(user.role === "recruiter" ? "dashboard" : "welcome");
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  function handleSelectPortal(nextPortal) {
    setPortal(nextPortal);
    setError("");
    setScreen("auth");
  }

  function handleAuth(user, token) {
    const normalizedUser = normalizeStoredUser(user);
    const payload = { user: normalizedUser, token };
    setAuth(payload);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setPortal(normalizedUser.role);
    setScreen(normalizedUser.role === "recruiter" ? "dashboard" : "welcome");
    setError("");
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY);
    setAuth({ user: null, token: "" });
    setPortal("");
    setTranscript("");
    setReport(null);
    setStatusMessage("");
    setError("");
    setScreen("portal");
  }

  function handleStart() {
    setTranscript("");
    setReport(null);
    setError("");
    setScreen("interview");
  }

  async function handleInterviewComplete(transcriptValue) {
    setTranscript(transcriptValue);
    setStatusMessage("ANALYZING SCREENING RESPONSES...");
    setScreen("saving");

    try {
      const evaluationResponse = await apiRequest("/evaluate", "POST", { transcript: transcriptValue }, auth.token);
      const normalized = normalizeEvaluation(evaluationResponse.evaluation);
      setReport(normalized);

      setStatusMessage("FINALIZING REPORT...");
      try {
        await apiRequest(
          "/interviews",
          "POST",
          {
            candidateName: auth.user.name,
            transcript: transcriptValue,
            evaluation: normalized,
          },
          auth.token
        );
      } catch (saveError) {
        console.error(saveError);
      }

      setScreen("report");
    } catch (err) {
      setError(err.message || "Unable to complete the interview flow.");
      setScreen("error");
    }
  }

  return (
    <>
      {screen === "portal" && <PortalSelectScreen onSelectPortal={handleSelectPortal} />}
      {screen === "auth" && portal && (
        <AuthScreen
          portal={portal}
          onAuth={handleAuth}
          onBack={() => {
            setPortal("");
            setScreen("portal");
          }}
        />
      )}
      {screen === "welcome" && auth.user && auth.user.role === "interviewee" && (
        <WelcomeScreen user={auth.user} onStart={handleStart} onLogout={handleLogout} />
      )}
      {screen === "interview" && auth.user && auth.user.role === "interviewee" && (
        <InterviewScreen
          user={auth.user}
          token={auth.token}
          onComplete={handleInterviewComplete}
          onCancel={() => setScreen("welcome")}
        />
      )}
      {screen === "saving" && <SavingScreen message={statusMessage} />}
      {screen === "report" && auth.user && report && auth.user.role === "interviewee" && (
        <ReportScreen
          user={auth.user}
          report={report}
          transcript={transcript}
          onRestart={handleStart}
          onLogout={handleLogout}
        />
      )}
      {screen === "dashboard" && auth.user && auth.user.role === "recruiter" && (
        <RecruiterDashboard user={auth.user} token={auth.token} onLogout={handleLogout} />
      )}
      {screen === "error" && <ErrorScreen message={error} onRetry={handleStart} onLogout={handleLogout} />}
    </>
  );
}
