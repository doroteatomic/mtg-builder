const express = require('express');
const router  = express.Router();
const { auth, db } = require('../firebase');

// ── POST /api/auth/register ───────────────────────────────────
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password)
    return res.status(400).json({ message: 'All fields are required.' });
  if (password.length < 8)
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });

  try {
    // Create user in Firebase Auth
    const userRecord = await auth.createUser({ email, password, displayName: username });

    // Save user profile in Firestore → users collection
    await db.collection('users').doc(userRecord.uid).set({
      uid:       userRecord.uid,
      username,
      email,
      createdAt: new Date().toISOString()
    });

    // Sign in immediately via REST API to get a real ID token
    const apiKey  = process.env.FIREBASE_API_KEY;
    const signinRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password, returnSecureToken: true })
      }
    );
    const signinData = await signinRes.json();

    if (!signinRes.ok) {
      // User created but couldn't get token — still success, let them log in manually
      return res.status(201).json({ username, uid: userRecord.uid, message: 'Registered. Please log in.' });
    }

    res.status(201).json({ token: signinData.idToken, username, uid: userRecord.uid });
  } catch (err) {
    if (err.code === 'auth/email-already-exists')
      return res.status(409).json({ message: 'An account with this email already exists.' });
    console.error('Register error:', err);
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required.' });

  try {
    // Firebase Admin cannot verify passwords directly — use REST API
    // Node 18+ has built-in fetch
    const apiKey = process.env.FIREBASE_API_KEY;

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password, returnSecureToken: true })
      }
    );
    const data = await response.json();

    if (!response.ok) {
      const msg = data.error?.message;
      if (msg === 'EMAIL_NOT_FOUND' || msg === 'INVALID_PASSWORD' || msg === 'INVALID_LOGIN_CREDENTIALS')
        return res.status(401).json({ message: 'Invalid email or password.' });
      return res.status(401).json({ message: 'Login failed.' });
    }

    // Get username from Firestore
    const userDoc = await db.collection('users').doc(data.localId).get();
    const username = userDoc.exists ? userDoc.data().username : email.split('@')[0];

    res.json({ token: data.idToken, username, uid: data.localId });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Login failed. Please try again.' });
  }
});

// ── POST /api/auth/logout ─────────────────────────────────────
router.post('/logout', (req, res) => {
  // JWT is stateless — client just removes token
  res.json({ message: 'Logged out.' });
});

module.exports = router;
