function StartScreen({ candidateName, onNameChange, onStart }) {
  return (
    <section className="panel">
      <p className="intro-label">Welcome to Cuemath</p>
      <h2>Practice your short tutor interview</h2>
      <p className="panel-copy">
        Enter your name, grant microphone access, and answer four teaching questions out loud.
      </p>

      <label className="field-label">
        Candidate name
        <input
          type="text"
          value={candidateName}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Your name"
        />
      </label>

      <button className="primary-button" onClick={onStart} disabled={!candidateName.trim()}>
        Start Interview
      </button>
    </section>
  );
}

export default StartScreen;
