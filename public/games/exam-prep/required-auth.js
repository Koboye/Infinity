import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

const gate = document.getElementById('ep-auth-gate');
const form = document.getElementById('ep-auth-form');
const title = document.getElementById('ep-auth-title');
const submit = document.getElementById('ep-auth-submit');
const toggle = document.getElementById('ep-auth-toggle');
const message = document.getElementById('ep-auth-message');
const nameField = document.getElementById('ep-auth-name');
let creating = false;
let auth;

function status(text) { message.textContent = text; }
function mode(up) {
  creating = up;
  title.textContent = up ? 'Create account' : 'Sign in';
  submit.textContent = up ? 'Create account' : 'Sign in';
  toggle.textContent = up ? 'Already have an account? Sign in' : 'New student? Create account';
  nameField.hidden = !up;
  nameField.required = up;
  form.elements.password.autocomplete = up ? 'new-password' : 'current-password';
  status('');
}
function allow(user) {
  gate.hidden = !!user;
  document.body.classList.toggle('ep-auth-locked', !user);
  const signout = document.getElementById('ep-auth-signout');
  signout.hidden = !user;
  window.dispatchEvent(new CustomEvent('infinity-auth-changed', { detail: { uid: user ? user.uid : null } }));
  if (user) {
    const splash = document.getElementById('splash');
    if (splash && !splash.hidden) splash.style.zIndex = '100';
  }
}
mode(false);
toggle.addEventListener('click', () => mode(!creating));
try {
  const response = await fetch('/api/exampro-auth-config', { cache: 'no-store' });
  if (!response.ok) throw new Error('Sign-in service unavailable. Please try again later.');
  const cfg = await response.json();
  if (!cfg.apiKey || !cfg.projectId || !cfg.authDomain || !cfg.appId) throw new Error('Sign-in is not configured yet. Please contact the app owner.');
  auth = getAuth(initializeApp(cfg, 'exampro-auth'));
  onAuthStateChanged(auth, user => allow(user), () => { allow(null); status('Unable to verify your account. Please try again.'); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    submit.disabled = true;
    status('');
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    try {
      if (creating) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const displayName = form.elements.displayName.value.trim();
        if (displayName) await updateProfile(result.user, { displayName });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      form.reset();
    } catch (error) {
      const errors = {
        'auth/email-already-in-use': 'This email already has an account. Please sign in.',
        'auth/invalid-email': 'Enter a valid email address.',
        'auth/weak-password': 'Use a password with at least 6 characters.',
        'auth/invalid-credential': 'Incorrect email or password.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.'
      };
      status(errors[error.code] || 'Could not authenticate. Please try again.');
    } finally { submit.disabled = false; }
  });
  document.getElementById('ep-auth-signout').addEventListener('click', () => signOut(auth));
} catch (error) {
  allow(null);
  status(error.message || 'Sign-in unavailable. Please try again later.');
  submit.disabled = true;
}
