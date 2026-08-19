const Groq = require('groq-sdk');

const KEY_ENV_VARS = ['GROQ_API_KEY', 'GROQ_API_KEY_2', 'GROQ_API_KEY_3'];
const clients = {};

function getClients() {
  const keys = KEY_ENV_VARS.map(name => process.env[name]).filter(Boolean);
  if (!keys.length) {
    const err = new Error('GROQ_API_KEY não configurada');
    err.status = 500;
    throw err;
  }
  return keys.map(apiKey => {
    if (!clients[apiKey]) clients[apiKey] = new Groq({ apiKey });
    return clients[apiKey];
  });
}

async function groqCreate(params) {
  return groqCall(client => client.chat.completions.create(params));
}

// Runs fn(client) against each configured key in order, failing over to the
// next key only on rate-limit/server errors (same policy as groqCreate).
async function groqCall(fn) {
  const clientList = getClients();
  let lastErr;
  for (const client of clientList) {
    try {
      return await fn(client);
    } catch (err) {
      lastErr = err;
      const retryable = err?.status === 429 || err?.status >= 500;
      if (!retryable) throw err;
    }
  }
  throw lastErr;
}

module.exports = { groqCreate, groqCall };
