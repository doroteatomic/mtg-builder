const express  = require('express');
const cors     = require('cors');
const path     = require('path');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const app = express();

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Static files (public/) ────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── API routes ────────────────────────────────────────────────
app.use('/api/auth',  require('./routes/auth'));
app.use('/api/decks', require('./routes/decks'));
app.use('/api/cards', require('./routes/cards'));

// ── Start server ──────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MTG Builder server running on http://localhost:${PORT}`);
});
