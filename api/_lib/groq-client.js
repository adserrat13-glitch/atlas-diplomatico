const Groq = require('groq-sdk');

let client;

function getClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    const err = new Error('GROQ_API_KEY não configurada');
    err.status = 500;
    throw err;
  }
  if (!client) client = new Groq({ apiKey });
  return client;
}

async function groqCreate(params) {
  return getClient().chat.completions.create(params);
}

module.exports = { groqCreate };
