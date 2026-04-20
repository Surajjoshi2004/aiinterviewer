function Result({ candidateName, transcript, evaluation, onRestart }) {
  const recommendation = evaluation?.recommendation || 'Pending';
  const scores = evaluation?.scores || {};
  const evidence = evaluation?.evidence || [];

  return (
    <section className="panel result-panel">
      <p className="intro-label">Interview complete</p>
      <h2>Evaluation for {candidateName || 'Candidate'}</h2>
      <p className="panel-copy">Review your structured report below and export it for hiring feedback.</p>

      <div className="result-card recommendation-card">
        <p className="result-label">Recommendation</p>
        <h3>{recommendation}</h3>
        {evaluation?.reason && <p>{evaluation.reason}</p>}
      </div>

      <div className="score-grid">
        {['Communication Clarity', 'Warmth', 'Patience', 'Ability to Simplify', 'English Fluency'].map((label) => (
          <div key={label} className="score-card">
            <p>{label}</p>
            <span>{scores[label] ?? '—'}</span>
          </div>
        ))}
      </div>

      <div className="evidence-panel">
        <p className="panel-copy">Highlighted transcript quotes</p>
        {evidence.length > 0 ? (
          <ul>
            {evidence.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        ) : (
          <p>No evidence quotes returned.</p>
        )}
      </div>

      <div className="transcript-review">
        <p className="panel-copy">Interview transcript</p>
        <pre>{transcript}</pre>
      </div>

      <button className="primary-button" onClick={onRestart}>
        Restart Interview
      </button>
    </section>
  );
}

export default Result;
