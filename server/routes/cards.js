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

// ── GET /api/cards — get user's saved card library ────────────
router.get('/', verifyToken, async (req, res) => {
  try {
    const snapshot = await db.collection('savedCards')
      .where('uid', '==', req.uid)
      .orderBy('savedAt', 'desc')
      .get();

    const cards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(cards);
  } catch (err) {
    console.error('Get saved cards error:', err);
    res.status(500).json({ message: 'Failed to fetch saved cards.' });
  }
});

// ── POST /api/cards — save a card to library ──────────────────
// Upsert: if same scryfallId already saved, skip duplicate
router.post('/', verifyToken, async (req, res) => {
  const { scryfallId, name, set, type, imageUrl, priceUsd } = req.body;

  if (!scryfallId || !name)
    return res.status(400).json({ message: 'scryfallId and name are required.' });

  try {
    // Check for existing entry
    const existing = await db.collection('savedCards')
      .where('uid', '==', req.uid)
      .where('scryfallId', '==', scryfallId)
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.status(200).json({ id: existing.docs[0].id, ...existing.docs[0].data(), duplicate: true });
    }

    const card = {
      uid: req.uid,
      scryfallId,
      name,
      set:      set      || '',
      type:     type     || '',
      imageUrl: imageUrl || '',
      priceUsd: priceUsd || null,
      savedAt:  new Date().toISOString()
    };

    const ref = await db.collection('savedCards').add(card);
    res.status(201).json({ id: ref.id, ...card });
  } catch (err) {
    console.error('Save card error:', err);
    res.status(500).json({ message: 'Failed to save card.' });
  }
});

// ── DELETE /api/cards/:id — remove card from library ──────────
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const ref = db.collection('savedCards').doc(req.params.id);
    const doc = await ref.get();

    if (!doc.exists) return res.status(404).json({ message: 'Card not found.' });
    if (doc.data().uid !== req.uid) return res.status(403).json({ message: 'Forbidden.' });

    await ref.delete();
    res.json({ message: 'Card removed from library.' });
  } catch (err) {
    console.error('Delete card error:', err);
    res.status(500).json({ message: 'Failed to remove card.' });
  }
});

module.exports = router;
