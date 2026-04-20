const BASE_URL = '/api';

export async function sendChat(message, history) {
  const response = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, history }),
  });

  if (!response.ok) {
    throw new Error('Failed to get AI response');
  }

  const data = await response.json();
  return data.reply;
}

export async function requestEvaluation(transcript) {
  const response = await fetch(`${BASE_URL}/evaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ transcript }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate evaluation');
  }

  const data = await response.json();
  return data.evaluation;
}
