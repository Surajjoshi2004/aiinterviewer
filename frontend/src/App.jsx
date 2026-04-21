import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "ai-tutor-screener-auth";
const BASE_API = import.meta.env.VITE_API_URL || "/api";
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

  const baseUrl = BASE_API.replace(/\/$/, "");
  const fullPath = path.startsWith("/") ? path : "/" + path;
  const response = await fetch(`${baseUrl}${fullPath}`, {
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
  const heights = [14, 24, 30, 18, 34, 20, 26, 14, 32, 18, 12, 24, 16];
  return (
    <div className="waveform-3d" aria-hidden="true">
      <svg width="70" height="28" viewBox="0 0 70 28">
        {heights.map((h, i) => (
          <rect key={i} x={i * 5 + 1} y={28 - h} width="3" height={h} fill={active ? (color === "var(--accent)" ? "#F5A623" : "#6B9BD2") : "#333"} rx="1" opacity={active ? 1 : 0.25}>
            {active && <animate attributeName="height" values={`${h};${h * 1.4};${h}`} dur="0.7s" repeatCount="indefinite" begin={`${i * 0.04}s`}/>}
          </rect>
        ))}
      </svg>
    </div>
  );
}

function ScoreRing({ score, max = 5 }) {
  const color = score >= 4 ? "#4ADE80" : score >= 3 ? "#F5A623" : "#F87171";
  const dashArray = score * 44;

  return (
    <svg width="52" height="52" viewBox="0 0 52 52" style={{ filter: `drop-shadow(0 2px 6px ${color}30)` }}>
      <circle cx="26" cy="26" r="22" fill="none" stroke="#1a1a1a" strokeWidth="6"/>
      <circle cx="26" cy="26" r="22" fill="none" stroke={color} strokeWidth="5" strokeDasharray={`${dashArray} 176`} strokeLinecap="round" transform="rotate(-90 26 26)">
        <animate attributeName="stroke-dasharray" from="0 176" to={`${dashArray} 176`} dur="0.8s" fill="freeze"/>
      </circle>
      <circle cx="26" cy="26" r="14" fill="#0d0d0d"/>
      <text x="26" y="30" textAnchor="middle" fontFamily="Georgia,serif" fontSize="13" fontWeight="700" fill={color}>{score}</text>
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
        <section className="hero-panel portal-panel" style={{ padding: '20px 24px', position: 'relative', overflow: 'hidden', minHeight: '180px' }}>
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.06 }} viewBox="0 0 400 100">
            <line x1="0" y1="25" x2="400" y2="25" stroke="#F5A623" strokeWidth="0.3"/>
            <line x1="0" y1="50" x2="400" y2="50" stroke="#F5A623" strokeWidth="0.3"/>
            <line x1="0" y1="75" x2="400" y2="75" stroke="#F5A623" strokeWidth="0.3"/>
            <line x1="100" y1="0" x2="100" y2="100" stroke="#F5A623" strokeWidth="0.3"/>
            <line x1="200" y1="0" x2="200" y2="100" stroke="#F5A623" strokeWidth="0.3"/>
            <line x1="300" y1="0" x2="300" y2="100" stroke="#F5A623" strokeWidth="0.3"/>
          </svg>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <svg width="40" height="40" viewBox="0 0 72 72" style={{ animation: 'floatY 4s ease-in-out infinite', filter: 'drop-shadow(0 4px 12px rgba(245,166,35,0.2))' }}>
              <ellipse cx="36" cy="70" rx="24" ry="5" fill="#F5A623" opacity="0.08"/>
              <polygon points="36,6 60,20 36,34 12,20" fill="#F5A623"/>
              <polygon points="36,6 60,20 48,27 24,13" fill="#FFD580" opacity="0.3"/>
              <polygon points="12,20 36,34 36,66 12,52" fill="#8A4800"/>
              <polygon points="60,20 36,34 36,66 60,52" fill="#CC7B0A"/>
              <text x="36" y="29" textAnchor="middle" fontFamily="Georgia,serif" fontSize="13" fontWeight="700" fill="#3D1A00" opacity="0.85">C</text>
            </svg>
            <div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '22px', letterSpacing: '2px', color: '#E2D9CE', lineHeight: 1 }}>
                Cue<span style={{ color: '#F5A623' }}>math</span>
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: '8px', letterSpacing: '2px', color: '#444', marginTop: '2px' }}>TUTOR SCREENING SYSTEM</div>
            </div>

            <div style={{ position: 'absolute', top: '12px', right: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4ADE80', animation: 'livePulse 2s ease-in-out infinite' }}/>
              <span style={{ fontSize: '8px', letterSpacing: '1px', color: '#4ADE80' }}>ONLINE</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button type="button" style={{ flex: 1, background: '#0D0D0D', border: '1px solid #1E1E1E', borderRadius: '8px', padding: '14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }} onClick={() => onSelectPortal("recruiter")} onMouseOver={e => e.currentTarget.style.borderColor = '#F5A623'} onMouseOut={e => e.currentTarget.style.borderColor = '#1E1E1E'}>
              <span style={{ fontSize: '9px', letterSpacing: '2px', color: '#444' }}>RECRUITER</span>
              <h2 style={{ color: '#E8E0D4', fontSize: '13px', fontWeight: 500, margin: 0 }}>Review dashboards</h2>
              <p style={{ color: '#666', fontSize: '11px', margin: 0 }}>Monitor interviews</p>
            </button>

            <button type="button" style={{ flex: 1, background: '#0D0D0D', border: '1px solid #1E1E1E', borderRadius: '8px', padding: '14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }} onClick={() => onSelectPortal("interviewee")} onMouseOver={e => e.currentTarget.style.borderColor = '#F5A623'} onMouseOut={e => e.currentTarget.style.borderColor = '#1E1E1E'}>
              <span style={{ fontSize: '9px', letterSpacing: '2px', color: '#444' }}>INTERVIEWEE</span>
              <h2 style={{ color: '#E8E0D4', fontSize: '13px', fontWeight: 500, margin: 0 }}>Take screening</h2>
              <p style={{ color: '#666', fontSize: '11px', margin: 0 }}>AI-led interview</p>
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

  function replayLastQuestion() {
    const lastAssistantMessage = messages.filter((m) => m.role === "assistant").pop();
    if (lastAssistantMessage) {
      speakAssistantMessage(lastAssistantMessage.text);
    }
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
    console.log("SpeechRecognition available:", !!SpeechRecognition);
    if (!SpeechRecognition) {
      setSpeechHint("Voice input not supported in this browser. Use Chrome or Edge.");
      return undefined;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    const handleResult = (event) => {
      let finalText = "";
      let interimText = "";

      for (let index = 0; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript || "";
        if (event.results[index].isFinal) {
          finalText += transcript + " ";
        } else {
          interimText += transcript;
        }
      }

      if (finalText) {
        const cleaned = finalText.trim().replace(/\s+/g, " ");
        finalTranscriptRef.current = `${finalTranscriptRef.current} ${cleaned}`.trim();
      }

      const nextText = `${finalTranscriptRef.current} ${interimText}`.trim();
      setLiveText(nextText);
      setAnswer(nextText);
    };

    const handleError = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      setSpeechHint("Mic error: " + event.error + ". Try typing or check mic permission.");
    };

    const handleEnd = () => {
      setIsListening(false);
      setSpeechHint("Recording ended. Review your answer or click to speak again.");
    };

    recognition.onresult = handleResult;
    recognition.onerror = handleError;
    recognition.onend = handleEnd;

    recognitionRef.current = recognition;
    setMicReady(true);
    console.log("SpeechRecognition initialized, mic ready");

    return () => {
      try {
        recognition.stop();
      } catch {
      }
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
    setSpeechHint("Raj is thinking about your answer...");

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

    const currentAnswer = answer.trim();
    if (currentAnswer) {
      finalTranscriptRef.current = currentAnswer;
    }

    setLiveText(currentAnswer);
    setError("");
    setSpeechHint("Listening now. Speak your answer...");

    try {
      const recognition = recognitionRef.current;
      if (recognition) {
        recognition.start();
        setIsListening(true);
      }
    } catch (err) {
      console.error("Start error:", err);
      setSpeechHint("Mic in use or not ready. Try again or type answer.");
    }
  }

  function stopListening() {
    try {
      recognitionRef.current?.stop();
    } catch {
    }
    setIsListening(false);
    setSpeechHint("Review your answer, then click SEND REPLY when ready.");
  }

  function handleFinish() {
    if (messages.length < 2) return;

    const transcript = messages
      .map((message) => `${message.role === "assistant" ? "Raj" : user.name}: ${message.text}`)
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
              <div className={`avatar-orb ${sending ? "is-speaking" : ""}`} style={{ width: '64px', height: '64px' }}>
                <svg width="64" height="64" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="36" fill="none" stroke="#F5A623" strokeWidth=".5" opacity=".15" strokeDasharray="4 5"/>
                  <circle cx="40" cy="40" r="30" fill="none" stroke="#F5A623" strokeWidth=".4" opacity=".1"/>
                  <circle cx="40" cy="40" r="26" fill="#180D00"/>
                  <ellipse cx="32" cy="28" rx="16" ry="12" fill="#F5A623" opacity=".1"/>
                  <ellipse cx="30" cy="25" rx="9" ry="6" fill="#FFD080" opacity=".15"/>
                  <ellipse cx="27" cy="22" rx="5" ry="3" fill="white" opacity=".12"/>
                  <text x="40" y="48" textAnchor="middle" fontFamily="'Bebas Neue',Georgia,serif" fontSize="26" fill="#F5A623" letterSpacing="1">R</text>
                </svg>
              </div>
              <div className="avatar-name">Raj</div>
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
                <div className="empty-state">Waiting for Raj...</div>
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
                  className="ghost-cta"
                  type="button"
                  onClick={replayLastQuestion}
                  disabled={loading || sending || messages.length < 1}
                  title="Hear the last question again"
                >
                  REPLAY QUESTION
                </button>
                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  disabled={!micReady || loading || sending}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    cursor: !micReady || loading || sending ? 'not-allowed' : 'pointer',
                    opacity: !micReady || loading || sending ? 0.5 : 1,
                    padding: 0,
                    animation: isListening ? 'none' : 'floatY 3.8s ease-in-out infinite'
                  }}
                >
                  <svg width="48" height="56" viewBox="0 0 80 90">
                    <ellipse cx="40" cy="86" rx="24" ry="4" fill="#F5A623" opacity="0.1"/>
                    <rect x="32" y="62" width="16" height="24" fill="#CC7B0A" rx="2"/>
                    <path d="M16,50 Q8,50 8,62 L8,70" fill="none" stroke="#CC7B0A" strokeWidth="4" strokeLinecap="round"/>
                    <path d="M72,50 Q80,50 80,62 L80,70" fill="none" stroke="#CC7B0A" strokeWidth="4" strokeLinecap="round"/>
                    <rect x="22" y="12" width="36" height="50" rx="18" fill={isListening ? "#E74C3C" : "#F5A623"}/>
                    <line x1="28" y1="28" x2="52" y2="28" stroke="#C06000" strokeWidth="1" opacity="0.4"/>
                    <line x1="28" y1="36" x2="52" y2="36" stroke="#C06000" strokeWidth="1" opacity="0.4"/>
                    <circle cx="40" cy="32" r="6" fill="#B85E00" opacity="0.5"/>
                    {isListening && (
                      <circle cx="40" cy="32" r="14" fill="none" stroke="#E74C3C" strokeWidth="2" opacity="0.6">
                        <animate attributeName="r" values="14;22;14" dur="1s" repeatCount="indefinite"/>
                        <animate attributeName="opacity" values="0.6;0;0.6" dur="1s" repeatCount="indefinite"/>
                      </circle>
                    )}
                  </svg>
                  <div style={{ fontSize: '7px', letterSpacing: '0.5px', color: isListening ? '#E74C3C' : '#555', marginTop: '2px' }}>
                    {!micReady ? "OFF" : isListening ? "STOP" : "SPEAK"}
                  </div>
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

          {report.recommendation === "proceed" ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: '#0A2A18', borderRadius: '6px', border: '1px solid #1A5030' }}>
              <span style={{ color: '#4ADE80', fontSize: '12px', fontWeight: 600 }}>PROCEED</span>
            </div>
          ) : report.recommendation === "reject" ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: '#1A0808', borderRadius: '6px', border: '1px solid #3D1010' }}>
              <span style={{ color: '#F87171', fontSize: '12px', fontWeight: 600 }}>REJECT</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: '#1A1000', borderRadius: '6px', border: '1px solid #3D2A00' }}>
              <span style={{ color: '#F5A623', fontSize: '12px', fontWeight: 600 }}>HOLD</span>
            </div>
          )}
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '6px', border: `1px solid ${selectedInterview.normalizedEvaluation.recommendation === 'proceed' ? '#1A5030' : selectedInterview.normalizedEvaluation.recommendation === 'reject' ? '#3D1010' : '#3D2A00'}`, background: selectedInterview.normalizedEvaluation.recommendation === 'proceed' ? '#0A2A18' : selectedInterview.normalizedEvaluation.recommendation === 'reject' ? '#1A0808' : '#1A1000' }}>
                    <span style={{ color: selectedInterview.normalizedEvaluation.recommendation === 'proceed' ? '#4ADE80' : selectedInterview.normalizedEvaluation.recommendation === 'reject' ? '#F87171' : '#F5A623', fontSize: '11px', fontWeight: 600 }}>
                      {selectedInterview.normalizedEvaluation.recommendation.toUpperCase()}
                    </span>
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
