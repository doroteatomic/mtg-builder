const express = require('express');
const router  = express.Router();
const { db, auth } = require('../firebase');

// ── Middleware: verify Firebase ID token ──────────────────────
async function verifyToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ message: 'Unauthorized.' });

  const token = header.split(' ')[1];
  try {
    const decoded = await auth.verifyIdToken(token);
    req.uid = decoded.uid;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

// ── GET /api/decks — get all decks for logged-in user ─────────
router.get('/', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('decks')
      .where('uid', '==', req.uid)
      .orderBy('updatedAt', 'desc')
      .get();

    const decks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(decks);
  } catch (err) {
    console.error('Get decks error:', err);
    res.status(500).json({ message: 'Failed to fetch decks.' });
  }
});

// ── POST /api/decks — create new deck ────────────────────────
router.post('/', verifyToken, async (req, res) => {
  const { name, format, colors, cards, notes } = req.body;

  if (!name) return res.status(400).json({ message: 'Deck name is required.' });

  try {
    const deck = {
      uid:       req.uid,
      name,
      format:    format || 'Standard',
      colors:    colors || [],
      cards:     cards  || [],
      notes:     notes  || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const ref = await db.collection('decks').add(deck);
    res.status(201).json({ id: ref.id, ...deck });
  } catch (err) {
    console.error('Create deck error:', err);
    res.status(500).json({ message: 'Failed to create deck.' });
  }
});

// ── PUT /api/decks/:id — update deck ─────────────────────────
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const ref = db.collection('decks').doc(req.params.id);
    const doc = await ref.get();

    if (!doc.exists) return res.status(404).json({ message: 'Deck not found.' });
    if (doc.data().uid !== req.uid) return res.status(403).json({ message: 'Forbidden.' });

    const updates = { ...req.body, updatedAt: new Date().toISOString() };
    delete updates.uid; // cannot change owner
    await ref.update(updates);

    res.json({ id: req.params.id, ...doc.data(), ...updates });
  } catch (err) {
    console.error('Update deck error:', err);
    res.status(500).json({ message: 'Failed to update deck.' });
  }
});

// ── DELETE /api/decks/:id — delete deck ──────────────────────
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const ref = db.collection('decks').doc(req.params.id);
    const doc = await ref.get();

    if (!doc.exists) return res.status(404).json({ message: 'Deck not found.' });
    if (doc.data().uid !== req.uid) return res.status(403).json({ message: 'Forbidden.' });

    await ref.delete();
    res.json({ message: 'Deck deleted.' });
  } catch (err) {
    console.error('Delete deck error:', err);
    res.status(500).json({ message: 'Failed to delete deck.' });
  }
});

module.exports = router;
