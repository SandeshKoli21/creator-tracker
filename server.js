require('dotenv').config({ quiet: true });

const path = require('path');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

// --- Startup env check ---
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}. Copy .env.example to .env and fill them in.`);
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const PLATFORMS = ['Instagram', 'YouTube'];
const MAX_NAME_LENGTH = 100;

// Returns { value } with the cleaned creator, or { error } with a message.
function validateCreator(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body must be a JSON object' };
  }

  const { name, platform, followers } = body;

  if (typeof name !== 'string' || name.trim() === '') {
    return { error: 'name is required' };
  }
  const trimmedName = name.trim();
  if (trimmedName.length > MAX_NAME_LENGTH) {
    return { error: `name must be at most ${MAX_NAME_LENGTH} characters` };
  }

  if (!PLATFORMS.includes(platform)) {
    return { error: `platform must be one of: ${PLATFORMS.join(', ')}` };
  }

  // Accept a number or a string of digits; reject decimals, negatives, zero and text.
  let followersNum;
  if (typeof followers === 'number') {
    followersNum = followers;
  } else if (typeof followers === 'string' && /^\d+$/.test(followers.trim())) {
    followersNum = Number(followers.trim());
  } else {
    return { error: 'followers must be a positive whole number' };
  }
  if (!Number.isSafeInteger(followersNum) || followersNum <= 0) {
    return { error: 'followers must be a positive whole number' };
  }

  return { value: { name: trimmedName, platform, followers: followersNum } };
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/creators', async (req, res) => {
  const { data, error } = await supabase
    .from('creators')
    .select('id, name, platform, followers, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  res.status(200).json(data);
});

app.post('/api/creators', async (req, res) => {
  const { value, error: validationError } = validateCreator(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { data, error } = await supabase
    .from('creators')
    .insert(value)
    .select('id, name, platform, followers, created_at')
    .single();

  if (error) throw error;
  res.status(201).json(data);
});

// Unknown API routes get JSON, not Express's HTML page.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// --- Error handler: broken JSON -> 400, everything else -> generic 500 ---
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body must be valid JSON' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Creator Tracker running at http://localhost:${PORT}`);
});
