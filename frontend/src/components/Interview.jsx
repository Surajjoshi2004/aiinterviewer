import { useEffect, useMemo, useRef, useState } from 'react';
import { requestEvaluation, sendChat } from '../api.js';

const QUESTIONS_LIMIT = 6;
const introMessage = 'Hello Raj. Begin the interview as a warm Cuemath HR representative and ask the first teaching question.';

function Interview({ candidateName, onComplete }) {
  const [currentQuestion, setCurrentQuestion] = useState('Preparing your interview...');
  const [transcript, setTranscript] = useState([]);
  const [history, setHistory] = useState([]);
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState('Waiting for the first question from Raj...');
  const [error, setError] = useState(null);
  const [turns, setTurns] = useState(0);
  const recognitionRef = useRef(null);
  const speechRef = useRef(null);

  const recognitionSupported = useMemo(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    return Boolean(SpeechRecognition);
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => {
      setListening(true);
      setStatus('Listening... speak now');
    };

    recognition.onresult = async (event) => {
      const transcriptText = event.results[0][0].transcript.trim();
      setStatus(`Captured answer: "${transcriptText}"`);
      setListening(false);
      await handleUserAnswer(transcriptText);
    };

    recognition.onerror = (event) => {
      setListening(false);
      setStatus('Microphone issue. Please try again.');
      console.error('Speech recognition error', event.error);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
  }, []);

  useEffect(() => {
    startInterview();
  }, []);

  const speakText = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  const startInterview = async () => {
    try {
      setStatus('Connecting with Raj...');
      const aiReply = await sendChat(introMessage, []);
      appendTranscript('Raj', aiReply);
      setHistory([{ role: 'assistant', content: aiReply }]);
      setCurrentQuestion(aiReply);
      setStatus('Ready for your first answer.');
      speakText(aiReply);
    } catch (err) {
      console.error(err);
      setError('Unable to start interview. Please check your connection.');
    }
  };

  const appendTranscript = (speaker, text) => {
    setTranscript((current) => [...current, { speaker, text }]);
  };

  const handleUserAnswer = async (text) => {
    if (!text) {
      setError('No input detected. Try again.');
      return;
    }

    const nextHistory = [...history, { role: 'user', content: text }];
    appendTranscript(candidateName || 'You', text);
    setTurns((value) => value + 1);
    setHistory(nextHistory);
    setStatus('Sending your answer to Raj...');

    try {
      const aiReply = await sendChat(text, nextHistory);
      const updatedHistory = [...nextHistory, { role: 'assistant', content: aiReply }];
      setHistory(updatedHistory);
      appendTranscript('Raj', aiReply);
      setCurrentQuestion(aiReply);
      setStatus('Raj has responded.');
      speakText(aiReply);

      const nextTurnCount = turns + 1;
      if (nextTurnCount >= QUESTIONS_LIMIT) {
        await finishInterview([...transcript, { speaker: candidateName || 'You', text }, { speaker: 'Raj', text: aiReply }]);
      }
    } catch (err) {
      console.error(err);
      setError('Raj is unavailable right now. Please try again later.');
    }
  };

  const finishInterview = async (finalTranscript) => {
    setStatus('Generating your evaluation report...');
    const transcriptText = finalTranscript
      .map((item) => `${item.speaker}: ${item.text}`)
      .join('\n');

    try {
      const evaluation = await requestEvaluation(transcriptText);
      onComplete(transcriptText, evaluation);
    } catch (err) {
      console.error(err);
      setError('Unable to generate report. Please try again.');
    }
  };

  const startListening = () => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  return (
    <section className="panel interview-panel">
      <div className="interview-header">
        <div>
          <p className="eyebrow">Live Interview</p>
          <h2>Raj is listening</h2>
          <p className="panel-copy">Answer the current question aloud. Raj will respond naturally and ask follow-ups when needed.</p>
        </div>
        <div className="status-pill">{status}</div>
      </div>

      <div className="question-box">
        <p className="question-label">Raj asks</p>
        <p className="question-text">{currentQuestion}</p>
      </div>

      <button className="secondary-button" onClick={startListening} disabled={!recognitionSupported}>
        {listening ? 'Stop listening' : 'Speak your answer'}
      </button>

      {error && <p className="error-text">{error}</p>}

      <div className="transcript-panel">
        <div className="transcript-header">
          <p>Transcript</p>
          <span>{transcript.length} lines</span>
        </div>
        <div className="transcript-list">
          {transcript.map((entry, index) => (
            <div key={index} className={`transcript-line ${entry.speaker === 'Raj' ? 'assistant' : 'candidate'}`}>
              <span className="transcript-speaker">{entry.speaker}</span>
              <p>{entry.text}</p>
            </div>
          ))}
        </div>
      </div>

      {!recognitionSupported && (
        <p className="error-text">Your browser does not support the Web Speech API. Please use Chrome or Edge.</p>
      )}
    </section>
  );
}

export default Interview;
