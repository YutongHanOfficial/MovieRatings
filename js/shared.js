import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getDatabase, ref, push, set, onValue, child, get, remove, query, orderByChild, limitToLast, update } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDPcQhADbFJzw54YLCMPKreZKKLmL1SRW8",
  authDomain: "the-movie-ratings.firebaseapp.com",
  databaseURL: "https://the-movie-ratings-default-rtdb.firebaseio.com",
  projectId: "the-movie-ratings",
  storageBucket: "the-movie-ratings.firebasestorage.app",
  messagingSenderId: "208532935279",
  appId: "1:208532935279:web:875fc444e712c75667b39a",
  measurementId: "G-6582T4SZKR"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Utility functions
const uid = () => Math.random().toString(36).slice(2, 9);
const nowISO = () => new Date().toISOString();
const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const escapeHtml = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Firebase refs
const movieRef = movieId => ref(db, `movies/${movieId}`);
const moviesRoot = () => ref(db, 'movies');
const ratingsRoot = movieId => ref(db, `ratings/${movieId}`);
const raterIndexRef = uid => ref(db, `raterIndex/${uid}`);
const verifiedUsersRef = () => ref(db, 'verifiedUsers');

let currentUser = null;
let currentVerified = {};

// Auth state
onAuthStateChanged(auth, user => {
  currentUser = user;
});

// Watch verified list
onValue(verifiedUsersRef(), snapshot => {
  currentVerified = snapshot.val() || {};
});

// Check if user is verified
async function checkVerified(user) {
  if (!user) return false;
  const uidKey = user.uid;
  const safeEmailKey = (user.email || '').replace('.', '_dot_');
  if (currentVerified[uidKey]) return true;
  if (currentVerified[safeEmailKey]) return true;
  if (currentVerified[user.email]) return true;
  return false;
}

// Get all movies with stats
async function getMoviesWithStats(filterQuery = '', onlyVerified = false, sortBy = 'avg') {
  const mSnap = await get(moviesRoot());
  const movies = mSnap.val() || {};
  let arr = Object.values(movies);

  if (filterQuery) {
    const q = filterQuery.toLowerCase();
    arr = arr.filter(m => (m.title + ' ' + (m.year || '')).toLowerCase().includes(q));
  }

  const withStats = await Promise.all(arr.map(async m => {
    const ratingsSnap = await get(ratingsRoot(m.id));
    const ratings = ratingsSnap.val() || {};
    const vals = Object.values(ratings).map(r => r.score || 0);
    const count = vals.length;
    const avg = count ? Math.round((vals.reduce((a, b) => a + b, 0) / count) * 100) / 100 : 0;
    const breakdown = {};
    for (let i = 1; i <= 10; i++) breakdown[i] = 0;
    Object.values(ratings).forEach(r => { breakdown[r.score] = (breakdown[r.score] || 0) + 1; });
    const hasVerified = Object.values(ratings).some(r => r.verified);
    return { ...m, stats: { avg, count, breakdown, hasVerified } };
  }));

  let final = withStats;
  if (onlyVerified) final = final.filter(m => m.stats.hasVerified);

  final.sort((a, b) => {
    if (sortBy === 'recent') return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortBy === 'avg') return (b.stats.avg || 0) - (a.stats.avg || 0);
    if (sortBy === 'count') return (b.stats.count || 0) - (a.stats.count || 0);
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    return 0;
  });

  return final;
}

// Render header on every page
function renderHeader(currentPage = 'home') {
  const header = document.querySelector('header');
  if (!header) return;

  const nav = document.createElement('nav');
  nav.style.cssText = 'display:flex;gap:12px;align-items:center;margin-left:auto;';

  const homeLink = document.createElement('a');
  homeLink.href = 'index.html';
  homeLink.textContent = '🏠 Home';
  homeLink.style.cssText = currentPage === 'home' ? 'color:var(--accent);text-decoration:none;font-weight:700' : 'color:var(--muted);text-decoration:none;cursor:pointer;';

  const leaderboardLink = document.createElement('a');
  leaderboardLink.href = 'leaderboard.html';
  leaderboardLink.textContent = '⭐ Leaderboard';
  leaderboardLink.style.cssText = currentPage === 'leaderboard' ? 'color:var(--accent);text-decoration:none;font-weight:700' : 'color:var(--muted);text-decoration:none;cursor:pointer;';

  nav.appendChild(homeLink);
  nav.appendChild(leaderboardLink);

  if (currentUser) {
    onValue(verifiedUsersRef(), async snapshot => {
      const verified = await checkVerified(currentUser);
      if (verified) {
        const addMovieLink = document.createElement('a');
        addMovieLink.href = 'add-movie.html';
        addMovieLink.textContent = '➕ Add Movie';
        addMovieLink.style.cssText = currentPage === 'add-movie' ? 'color:var(--accent);text-decoration:none;font-weight:700' : 'color:var(--muted);text-decoration:none;cursor:pointer;';
        nav.appendChild(addMovieLink);
      }
    });
  }

  header.appendChild(nav);
}

export { db, auth, provider, uid, nowISO, slugify, escapeHtml, movieRef, moviesRoot, ratingsRoot, raterIndexRef, verifiedUsersRef, currentUser, currentVerified, checkVerified, getMoviesWithStats, renderHeader };
