import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

const gate = document.getElementById('ep-auth-gate');
const form = document.getElementById('ep-auth-form');
const title = document.getElementById('ep-auth-title');
const submit = document.getElementById('ep-auth-submit');
const toggle = document.getElementById('ep-auth-toggle');
const message = document.getElementById('ep-auth-message');
const nameField = document.getElementById('ep-auth-name');
const gradeField = document.getElementById('in-auth-grade');
const departmentField = document.getElementById('in-auth-department');
const departmentStorageKey = uid => 'infinity.learning.department.' + uid;
function rememberDepartment(uid, id) { try { localStorage.setItem(departmentStorageKey(uid), id); } catch (e) {} }
function selectedDepartment(uid) { try { return localStorage.getItem(departmentStorageKey(uid)) || ''; } catch (e) { return ''; } }
const gradeStorageKey = uid => 'infinity.learning.grade.' + uid;
let currentUserId = null;
let submittingCredentials = false;
function selectedGrade(uid) { try { return localStorage.getItem(gradeStorageKey(uid)) || ''; } catch (e) { return ''; } }
function rememberGrade(uid, grade) { try { localStorage.setItem(gradeStorageKey(uid), grade); } catch (e) {} }
function syncGradeField(uid) { if (!uid) return; const grade = selectedGrade(uid); if (grade) gradeField.value = grade;
  gradeField.dispatchEvent(new Event('change'));
  const department = selectedDepartment(uid);
  if (department) departmentField.value = department; }

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
  gradeField.required = true;
  status('');
}
function allow(user) {
  if (user && submittingCredentials) return;
  currentUserId = user ? user.uid : null;
  window.infinityStudentUid = currentUserId;
  if (window.infinitySetProfileIdentity) window.infinitySetProfileIdentity(user);
  if (user) syncGradeField(user.uid);
  gate.hidden = !!user;
  document.body.classList.toggle('ep-auth-locked', !user);
  const signout = document.getElementById('ep-auth-signout');
  signout.hidden = !user;
  window.dispatchEvent(new CustomEvent('infinity-auth-changed', { detail: { uid: user ? user.uid : null } }));
  if (user) window.dispatchEvent(new CustomEvent('infinity-grade-changed', { detail: { grade: selectedGrade(user.uid), department: selectedDepartment(user.uid) } }));
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
    submittingCredentials = true;
    status('');
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const requestedGrade = gradeField.value;
    const requestedDepartment = departmentField.value;
    if (requestedGrade === 'uni' && !requestedDepartment) { status('Choose your university department.'); submittingCredentials = false; submit.disabled = false; departmentField.focus(); return; }
    if (!requestedGrade) { status('Choose your learning level before continuing.'); submittingCredentials = false; submit.disabled = false; gradeField.focus(); return; }
    try {
      if (creating) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const displayName = form.elements.displayName.value.trim();
        rememberGrade(result.user.uid, requestedGrade);
        rememberDepartment(result.user.uid, requestedGrade === 'uni' ? requestedDepartment : '');
        if (displayName) await updateProfile(result.user, { displayName });
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        rememberGrade(result.user.uid, requestedGrade);
        rememberDepartment(result.user.uid, requestedGrade === 'uni' ? requestedDepartment : '');
      }
      form.reset();
      // The finally handler calls allow() after UID, grade and department are saved.
    } catch (error) {
      const errors = {
        'auth/email-already-in-use': 'This email already has an account. Please sign in.',
        'auth/invalid-email': 'Enter a valid email address.',
        'auth/weak-password': 'Use a password with at least 6 characters.',
        'auth/invalid-credential': 'Incorrect email or password.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.'
      };
      status(errors[error.code] || 'Could not authenticate. Please try again.');
    } finally { submittingCredentials = false; if (auth.currentUser) allow(auth.currentUser); submit.disabled = false; }
  });
  document.getElementById('ep-auth-signout').addEventListener('click', () => signOut(auth));
} catch (error) {
  allow(null);
  status(error.message || 'Sign-in unavailable. Please try again later.');
  submit.disabled = true;
}
