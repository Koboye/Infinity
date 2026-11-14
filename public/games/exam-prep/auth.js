/* ExamPro authentication. Configure window.EXAMPRO_FIREBASE_CONFIG in firebase-config.js.
   Never store passwords or invent local accounts. Firestore access requires per-user security rules. */
(function(){
'use strict';
const CONFIG=window.EXAMPRO_FIREBASE_CONFIG;
const PROFILE='exampro.profile.v1', PROGRESS='examprep.static.v1', PLAN='exampro.plan.v1';
let auth=null,db=null,api=null,user=null,mode='signin',busy=false;
const $=id=>document.getElementById(id);
const modal=document.createElement('section');modal.id='ep-auth';modal.className='ep-auth';modal.hidden=true;
modal.innerHTML='<div class="ep-auth-card" role="dialog" aria-modal="true" aria-labelledby="ep-auth-title"><button type="button" class="ep-auth-back" id="ep-auth-back">← Back</button><div class="ep-auth-brand">🎓 <strong>exam<span>.pro</span></strong></div><div class="ep-auth-tabs"><button id="ep-tab-in" type="button">Sign in</button><button id="ep-tab-up" type="button">Create account</button></div><h1 id="ep-auth-title">Welcome back</h1><p class="ep-auth-sub" id="ep-auth-sub">Your learning, saved securely.</p><form id="ep-auth-form"><label id="ep-name-wrap" hidden>Student name<input id="ep-auth-name" autocomplete="name" maxlength="80"></label><label>Email<input id="ep-auth-email" type="email" autocomplete="email" required></label><label>Password<input id="ep-auth-password" type="password" autocomplete="current-password" minlength="6" required></label><label id="ep-grade-wrap" hidden>Learning level<select id="ep-auth-grade"><option value="">Choose your level</option><option value="kg">Kindergarten</option><option value="g1_4">Grades 1–4</option><option value="g5_8">Grades 5–8</option><option value="g9_10">Grades 9–10</option><option value="g12">Grades 11–12</option><option value="university">University / College</option></select></label><button class="ep-auth-primary" type="submit" id="ep-auth-submit">Sign in →</button></form><button type="button" id="ep-auth-reset" class="ep-auth-link">Forgot password?</button><div class="ep-auth-divider">or</div><button type="button" id="ep-auth-google" class="ep-auth-google">Continue with Google</button><p class="ep-auth-error" id="ep-auth-error" role="status" aria-live="polite"></p><p class="ep-auth-note">Your account and study data are private. We never save your password in this browser.</p></div>';
document.body.appendChild(modal);
const css=document.createElement('style');css.textContent=`
.ep-auth[hidden]{display:none!important}.ep-auth{position:fixed;inset:0;z-index:100001;overflow-y:auto;display:grid;place-items:center;padding:22px;background:linear-gradient(135deg,#00338e,#075ac8)}
.ep-auth-card{width:min(100%,460px);background:#fff;color:#172a56;border-radius:25px;padding:25px clamp(18px,5vw,32px);box-shadow:0 24px 65px #00184a66}
.ep-auth-back,.ep-auth-link{border:0;background:transparent;color:#2459bc;cursor:pointer;font-weight:750;padding:8px 0}
.ep-auth-brand{text-align:center;font-size:29px;margin:0 0 19px}.ep-auth-brand strong{letter-spacing:-.06em}.ep-auth-brand span{color:#f3b516}
.ep-auth-tabs{display:grid;grid-template-columns:1fr 1fr;gap:5px;background:#edf2fc;border-radius:13px;padding:5px}.ep-auth-tabs button{border:0;border-radius:10px;background:transparent;padding:12px 6px;font-weight:850;color:#51688e;cursor:pointer}.ep-auth-tabs button.active{background:#0754c4;color:white}
.ep-auth h1{font-size:26px;text-align:center;margin:20px 0 5px;color:#142c60}.ep-auth-sub{text-align:center;font-size:13px;color:#657895;margin:0 0 20px}
.ep-auth form{display:grid;gap:13px}.ep-auth label{display:grid;gap:6px;font-size:12px;font-weight:800;color:#314773}.ep-auth input,.ep-auth select{width:100%;border:1px solid #cbd7ed;border-radius:12px;padding:13px;font:inherit;background:#fff;color:#1a2c54;min-height:48px}
.ep-auth input:focus,.ep-auth select:focus{outline:3px solid #a9caff}.ep-auth-primary{background:linear-gradient(#ffdd61,#ffbf24);border:0;border-radius:13px;min-height:51px;font-size:16px;font-weight:900;color:#152c60;cursor:pointer}
.ep-auth-google{border:1px solid #cbd7ed;border-radius:13px;background:#fff;color:#1d3668;width:100%;min-height:48px;font-weight:850;cursor:pointer}.ep-auth-divider{text-align:center;color:#8a9bb6;margin:13px}.ep-auth-error{color:#a4233b;font-size:12px;min-height:16px;text-align:center}.ep-auth-note{font-size:11px;text-align:center;color:#7888a2;line-height:1.5}.ep-auth button:focus-visible{outline:3px solid #f5c335;outline-offset:3px}
`;document.head.appendChild(css);
function message(m){$('ep-auth-error').textContent=m||''}
function setMode(m){mode=m;$('ep-tab-in').classList.toggle('active',m==='signin');$('ep-tab-up').classList.toggle('active',m==='signup');$('ep-auth-title').textContent=m==='signup'?'Create your account':'Welcome back';$('ep-auth-sub').textContent=m==='signup'?'Make your learning journey yours.':'Sign in to continue learning.';$('ep-name-wrap').hidden=m!=='signup';$('ep-grade-wrap').hidden=m!=='signup';$('ep-auth-submit').textContent=m==='signup'?'Create account →':'Sign in →';$('ep-auth-reset').hidden=m==='signup';$('ep-auth-password').autocomplete=m==='signup'?'new-password':'current-password';message('')}
function open(){modal.hidden=false;document.body.style.overflow='hidden';setMode('signin');$('ep-auth-email').focus()}
function close(){modal.hidden=true;document.body.style.overflow=''}
$('ep-auth-back').onclick=close;$('ep-tab-in').onclick=()=>setMode('signin');$('ep-tab-up').onclick=()=>setMode('signup');
function getLocal(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function putLocal(key,value){if(value!=null)localStorage.setItem(key,JSON.stringify(value))}
async function sync(u){
 if(!db||!api)return;
 const ref=api.doc(db,'students',u.uid);
 const snap=await api.getDoc(ref);
 const remote=snap.exists()?snap.data():{};
 // A first login imports this browser's learning data; subsequent logins prefer the cloud.
 if(snap.exists()){for(const [key,val] of [[PROFILE,remote.profile],[PROGRESS,remote.progress],[PLAN,remote.plan]])if(val)putLocal(key,val)}
 let profile=getLocal(PROFILE)||{};
 if(!snap.exists())profile={...profile,name:u.displayName||profile.name||'',email:u.email||'',uid:u.uid};
 else profile={...profile,email:u.email||'',uid:u.uid};
 putLocal(PROFILE,profile);
 await api.setDoc(ref,{profile,progress:getLocal(PROGRESS)||{},plan:getLocal(PLAN)||{},updatedAt:api.serverTimestamp()},{merge:true});
}
async function afterAuth(u){user=u;try{await sync(u)}catch(e){message('Signed in, but cloud sync failed. Your local progress is preserved.');return}close();document.dispatchEvent(new CustomEvent('exampro:auth-changed',{detail:{uid:u.uid,email:u.email}}));}
async function ensureReady(){if(!auth||!api)throw Error('Secure sign-in is not configured yet. Add the Firebase web configuration to firebase-config.js and enable Firebase Authentication and Firestore.')}
$('ep-auth-form').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;message('');try{await ensureReady();let email=$('ep-auth-email').value.trim(),pass=$('ep-auth-password').value;let result;if(mode==='signup'){let name=$('ep-auth-name').value.trim(),stage=$('ep-auth-grade').value;if(!name||!stage)throw Error('Enter your name and choose your learning level.');result=await api.createUserWithEmailAndPassword(auth,email,pass);await api.updateProfile(result.user,{displayName:name});putLocal(PROFILE,{...(getLocal(PROFILE)||{}),name,stage});}else result=await api.signInWithEmailAndPassword(auth,email,pass);await afterAuth(result.user)}catch(err){message(err.code==='auth/email-already-in-use'?'This email already has an account. Please sign in.':err.code==='auth/invalid-credential'?'Incorrect email or password.':err.message||'Sign-in failed.')}finally{busy=false}};
$('ep-auth-google').onclick=async()=>{try{await ensureReady();const r=await api.signInWithPopup(auth,new api.GoogleAuthProvider());await afterAuth(r.user)}catch(e){message(e.message||'Google sign-in failed.')}};
$('ep-auth-reset').onclick=async()=>{try{await ensureReady();let email=$('ep-auth-email').value.trim();if(!email)throw Error('Enter your email first.');await api.sendPasswordResetEmail(auth,email);message('Password reset email sent.')}catch(e){message(e.message)}};
window.ExamProAuth={open,close,get configured(){return !!(CONFIG&&CONFIG.apiKey&&CONFIG.projectId)},get user(){return user},signOut:async()=>{await ensureReady();await api.signOut(auth);user=null;document.dispatchEvent(new Event('exampro:auth-changed'))},saveProgress:async()=>{if(!user||!db)return;await api.setDoc(api.doc(db,'students',user.uid),{profile:getLocal(PROFILE)||{},progress:getLocal(PROGRESS)||{},plan:getLocal(PLAN)||{},updatedAt:api.serverTimestamp()},{merge:true})}};
document.addEventListener('click',e=>{const btn=e.target.closest('[data-ep-auth]');if(btn){e.preventDefault();open()}});
if(CONFIG&&CONFIG.apiKey&&CONFIG.projectId){(async()=>{try{const [app,fb,fs]=await Promise.all([import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')]);const a=app.initializeApp(CONFIG,'exampro-static');auth=fb.getAuth(a);db=fs.getFirestore(a);api={...fb,...fs};fb.onAuthStateChanged(auth,async u=>{user=u;if(u){try{await sync(u);document.dispatchEvent(new Event('exampro:auth-changed'))}catch(e){console.warn('ExamPro sync unavailable',e)}}});}catch(e){console.warn('ExamPro authentication initialization failed',e)}})()}
})();
