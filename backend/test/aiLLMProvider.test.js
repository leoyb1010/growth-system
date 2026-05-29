const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');

const providerPath = '../src/ai/services/aiLLMProvider';

function reloadProviderWithEnv(env = {}) {
  const resolved = require.resolve(providerPath);
  delete require.cache[resolved];
  Object.assign(process.env, env);
  return require(providerPath);
}

test('LLM provider records auth failures without leaking API keys', async () => {
  const oldKey = process.env.AI_LLM_API_KEY;
  const oldPost = axios.post;
  const oldConsoleError = console.error;
  axios.post = async () => {
    const err = new Error('unauthorized');
    err.response = { status: 401, data: { error: 'bad key' } };
    throw err;
  };
  console.error = () => {};

  try {
    const provider = reloadProviderWithEnv({ AI_LLM_API_KEY: 'secret-test-key' });
    assert.equal(provider.isAvailable(), true);
    await assert.rejects(() => provider.call('system', 'user'), /鉴权失败/);

    const status = provider.getStatus();
    assert.equal(status.available, false);
    assert.equal(status.configured, true);
    assert.equal(status.lastError, 'auth_failed');
    assert.equal(status.lastHttpStatus, 401);
    assert.equal(JSON.stringify(status).includes('secret-test-key'), false);
  } finally {
    axios.post = oldPost;
    console.error = oldConsoleError;
    if (oldKey === undefined) delete process.env.AI_LLM_API_KEY;
    else process.env.AI_LLM_API_KEY = oldKey;
    delete require.cache[require.resolve(providerPath)];
  }
});

test('LLM provider allows disabling response_format for JSON prompts', async () => {
  const oldKey = process.env.AI_LLM_API_KEY;
  const oldPost = axios.post;
  let capturedBody = null;

  axios.post = async (_url, body) => {
    capturedBody = body;
    return { data: { choices: [{ message: { content: '{"ok":true}' } }] } };
  };

  try {
    const provider = reloadProviderWithEnv({ AI_LLM_API_KEY: 'secret-test-key' });
    const result = await provider.chatJSON({ prompt: 'return json', responseFormat: false });
    assert.deepEqual(result, { ok: true });
    assert.equal(Object.prototype.hasOwnProperty.call(capturedBody, 'response_format'), false);
  } finally {
    axios.post = oldPost;
    if (oldKey === undefined) delete process.env.AI_LLM_API_KEY;
    else process.env.AI_LLM_API_KEY = oldKey;
    delete require.cache[require.resolve(providerPath)];
  }
});
