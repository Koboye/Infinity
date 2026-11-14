/* ExamPro authentication. Configure window.EXAMPRO_FIREBASE_CONFIG in firebase-config.js.
   Never store passwords or invent local accounts. Firestore access requires per-user security rules. */
(function(){
'use strict';
const CONFIG=window.EXAMPRO_FIREBASE_CONFIG;
const PROFILE='exampro.profile.v1', PROGRESS='examprep.static.v1', PLAN='exampro.plan.v1';
let auth=null,db=null,api=null,user=null,mode='signin',busy=false;
const $=id=>document.getElementById(id);
const modal=document.createElement('section');modal.id='ep-auth';modal.className='ep-auth';modal.hidden=true;
modal.innerHTML='<div class="ep-auth-card" role="dialog" aria-modal="true" aria-labelledby="ep-auth-title"><button type="button" class="ep-auth-back" id="ep-auth-back">← Back</button><div class="ep-auth-brand">🎓 <strong>exam<span>.pro</span></strong></div><div class="ep-auth-tabs"><button id="ep-tab-in" type="button">Sign in</button><button id="ep-tab-up" type="button">Create account</button></div><h1 id="ep-auth-title">Welcome back</h1><p class="ep-auth-sub" id="ep-auth-sub">Your learning, saved securely.</p><form id="ep-auth-form"><label id="ep-name-wrap" hidden>Student name<input id="ep-auth-name" autocomplete="name" maxlength="80"></label><label>Email<input id="ep-auth-email" type="email" autocomplete="email" required></label><label>Password<input id="ep-auth-password" type="password" autocomplete="current-password" minlength="6" required></label><label id="ep-grade-wrap" hidden>Learning level<select id="ep-auth-grade"><option value="">Choose your level</option><option value="kg">Kindergarten</option><option value="g1">Grade 1</option><option value="g2">Grade 2</option><option value="g3">Grade 3</option><option value="g4">Grade 4</option><option value="g5">Grade 5</option><option value="g6">Grade 6</option><option value="g7">Grade 7</option><option value="g8">Grade 8</option><option value="g9">Grade 9</option><option value="g10">Grade 10</option><option value="g11">Grade 11</option><option value="g12">Grade 12</option><option value="university">University / College</option></select></label><button class="ep-auth-primary" type="submit" id="ep-auth-submit">Sign in →</button></form><button type="button" id="ep-auth-reset" class="ep-auth-link">Forgot password?</button><div class="ep-auth-divider">or</div><button type="button" id="ep-auth-google" class="ep-auth-google">Continue with Google</button><p class="ep-auth-error" id="ep-auth-error" role="status" aria-live="polite"></p><p class="ep-auth-note">Your account and study data are private. We never save your password in this browser.</p></div>';
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

/* v3: readable, spacious, accessible authentication layout */
.ep-auth{background:radial-gradient(circle at 18% 8%,#2b78e7 0,transparent 37%),linear-gradient(145deg,#052967 0%,#0752ba 75%,#083c92 100%);padding:clamp(14px,4vh,36px) 16px!important}
.ep-auth-card{max-width:440px!important;border-radius:24px!important;padding:clamp(20px,4vw,34px)!important;box-shadow:0 30px 90px #001b5660!important;position:relative}
.ep-auth label[hidden],.ep-auth [hidden]{display:none!important}
.ep-auth-back{display:inline-flex;align-items:center;gap:5px;font-size:13px!important;color:#647795!important}
.ep-auth-brand{font-size:30px!important;margin:5px 0 21px!important;color:#133a83!important}
.ep-auth-tabs{gap:6px!important;padding:5px!important;margin-bottom:20px!important}
.ep-auth-tabs button{min-height:44px!important;font-size:13px!important;white-space:nowrap}
.ep-auth h1{font-size:clamp(23px,5vw,28px)!important;line-height:1.2!important;margin:0 0 8px!important}
.ep-auth-sub{font-size:13px!important;line-height:1.5!important;margin:0 0 23px!important}
.ep-auth form{gap:14px!important}
.ep-auth label{font-size:13px!important;gap:7px!important;line-height:1.3!important}
.ep-auth input,.ep-auth select{display:block!important;box-sizing:border-box!important;min-width:0!important;font-size:15px!important;line-height:1.3!important;min-height:50px!important;padding:13px 14px!important;border:1.5px solid #d6e0ef!important;border-radius:11px!important;box-shadow:none!important}
.ep-auth input:focus,.ep-auth select:focus{border-color:#1462d3!important;outline:3px solid #dbe9ff!important}
.ep-auth-primary{margin-top:5px!important;min-height:52px!important;border-radius:12px!important;box-shadow:0 4px 0 #d49a18!important;cursor:pointer}
.ep-auth-primary:disabled,.ep-auth-google:disabled{opacity:.65;cursor:wait;box-shadow:none!important}
.ep-auth-link{font-size:13px!important;display:block;margin:13px 0 0 auto!important}
.ep-auth-divider{display:flex;align-items:center;gap:12px;margin:18px 0!important;font-size:12px!important}
.ep-auth-divider:before,.ep-auth-divider:after{content:"";height:1px;background:#e1e8f2;flex:1}
.ep-auth-google{min-height:50px!important;font-size:14px!important}
.ep-auth-error{margin:12px 0 0!important;line-height:1.5!important;font-weight:650!important}
.ep-auth-error:empty{display:none!important}
.ep-auth-note{margin:17px 0 0!important;font-size:11px!important}
@media(max-width:420px){.ep-auth-card{padding:21px 17px!important}.ep-auth-brand{margin-bottom:15px!important}.ep-auth-tabs{margin-bottom:17px!important}.ep-auth-sub{margin-bottom:17px!important}}
`;document.head.appendChild(css);
function message(m){$('ep-auth-error').textContent=m||''}
function setBusy(on){busy=on;$('ep-auth-submit').disabled=on;$('ep-auth-google').disabled=on;$('ep-auth-submit').textContent=on?'Please wait…':mode==='signup'?'Create account →':'Sign in →'}
function setMode(m){mode=m;$('ep-tab-in').classList.toggle('active',m==='signin');$('ep-tab-up').classList.toggle('active',m==='signup');$('ep-auth-title').textContent=m==='signup'?'Create your account':'Welcome back';$('ep-auth-sub').textContent=m==='signup'?'Make your learning journey yours.':'Sign in to continue learning.';$('ep-name-wrap').hidden=m!=='signup';$('ep-grade-wrap').hidden=m!=='signup';$('ep-auth-submit').textContent=m==='signup'?'Create account →':'Sign in →';$('ep-auth-reset').hidden=m==='signup';$('ep-auth-password').autocomplete=m==='signup'?'new-password':'current-password';message('')}
function open(){modal.hidden=false;document.body.style.overflow='hidden';setMode('signin');$('ep-auth-email').focus()}
function close(){modal.hidden=true;document.body.style.overflow=''}
$('ep-auth-back').onclick=close;$('ep-tab-in').onclick=()=>setMode('signin');$('ep-tab-up').onclick=()=>setMode('signup');
function getLocal(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function putLocal(key,value){if(value!=null)localStorage.setItem(key,JSON.stringify(value))}
const OWNER='exampro.active.uid';
let creatingAccount=false;
async function sync(u){
 if(!db||!api)return;
 const ref=api.doc(db,'students',u.uid);
 const snap=await api.getDoc(ref);
 const remote=snap.exists()?snap.data():{};
 const prior=localStorage.getItem(OWNER);
 // Never attribute another student's browser records to this signed-in account.
 if(prior&&prior!==u.uid){[PROFILE,PROGRESS,PLAN].forEach(key=>localStorage.removeItem(key));}
 if(snap.exists()){
   for(const [key,val] of [[PROFILE,remote.profile],[PROGRESS,remote.progress],[PLAN,remote.plan]]){
     if(val&&typeof val==='object')putLocal(key,val);
     else if(prior&&prior!==u.uid)localStorage.removeItem(key);
   }
 }
 let profile=getLocal(PROFILE)||{};
 profile={...profile,name:profile.name||u.displayName||'',email:u.email||'',uid:u.uid};
 putLocal(PROFILE,profile);
 localStorage.setItem(OWNER,u.uid);
 await api.setDoc(ref,{profile,progress:getLocal(PROGRESS)||{},plan:getLocal(PLAN)||{},updatedAt:api.serverTimestamp()},{merge:true});
}
async function afterAuth(u){user=u;try{await sync(u)}catch(e){console.warn('ExamPro cloud progress sync failed; keeping local progress',e)}close();document.dispatchEvent(new CustomEvent('exampro:auth-changed',{detail:{uid:u.uid,email:u.email}}));}
async function ensureReady(){if(!auth||!api)throw Error('Secure sign-in is not configured yet. Add the Firebase web configuration to firebase-config.js and enable Firebase Authentication and Firestore.')}
$('ep-auth-form').onsubmit=async e=>{e.preventDefault();if(busy)return;setBusy(true);message('');try{await ensureReady();let email=$('ep-auth-email').value.trim(),pass=$('ep-auth-password').value;let result;if(mode==='signup'){let name=$('ep-auth-name').value.trim(),stage=$('ep-auth-grade').value;if(!name||!stage)throw Error('Enter your name and choose your learning level.');creatingAccount=true;try{result=await api.createUserWithEmailAndPassword(auth,email,pass);await api.updateProfile(result.user,{displayName:name});putLocal(PROFILE,{...(getLocal(PROFILE)||{}),name,stage});}finally{creatingAccount=false;}}else result=await api.signInWithEmailAndPassword(auth,email,pass);await afterAuth(result.user)}catch(err){message(err.code==='auth/email-already-in-use'?'This email already has an account. Please sign in.':err.code==='auth/invalid-credential'?'Incorrect email or password.':({'auth/network-request-failed':'Network problem. Check your connection and try again.','auth/too-many-requests':'Too many attempts. Please try again later.','auth/weak-password':'Use a password with at least 6 characters.','auth/operation-not-allowed':'This sign-in method is not enabled in Firebase.'}[err.code]||err.message||'Sign-in failed.'))}finally{setBusy(false)}};
$('ep-auth-google').onclick=async()=>{if(busy)return;setBusy(true);try{await ensureReady();const r=await api.signInWithPopup(auth,new api.GoogleAuthProvider());await afterAuth(r.user)}catch(e){message(e.message||'Google sign-in failed.')}finally{setBusy(false)}};
$('ep-auth-reset').onclick=async()=>{try{await ensureReady();let email=$('ep-auth-email').value.trim();if(!email)throw Error('Enter your email first.');await api.sendPasswordResetEmail(auth,email);message('Password reset email sent.')}catch(e){message(e.message)}};
window.ExamProAuth={open,close,get configured(){return !!(CONFIG&&CONFIG.apiKey&&CONFIG.projectId)},get user(){return user},signOut:async()=>{await ensureReady();await api.signOut(auth);user=null;[PROFILE,PROGRESS,PLAN].forEach(key=>localStorage.removeItem(key));localStorage.removeItem(OWNER);document.dispatchEvent(new Event('exampro:auth-changed'))},saveProgress:async()=>{if(!user||!db)return;await api.setDoc(api.doc(db,'students',user.uid),{profile:getLocal(PROFILE)||{},progress:getLocal(PROGRESS)||{},plan:getLocal(PLAN)||{},updatedAt:api.serverTimestamp()},{merge:true})}};
// Periodically sync updated learning progress without blocking study sessions.
setInterval(()=>{if(user&&db&&api&&document.visibilityState==='visible')window.ExamProAuth.saveProgress().catch(e=>console.warn('Background progress sync failed',e));},60000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&user&&db&&api)window.ExamProAuth.saveProgress().catch(()=>{});});
document.addEventListener('click',e=>{const btn=e.target.closest('[data-ep-auth]');if(btn){e.preventDefault();open()}});
if(CONFIG&&CONFIG.apiKey&&CONFIG.projectId){(async()=>{try{const [app,fb,fs]=await Promise.all([import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')]);const a=app.initializeApp(CONFIG,'exampro-static');auth=fb.getAuth(a);db=fs.getFirestore(a);api={...fb,...fs};fb.onAuthStateChanged(auth,async u=>{user=u;if(u){if(creatingAccount)return;try{await sync(u)}catch(e){console.warn('ExamPro sync unavailable',e)}document.dispatchEvent(new CustomEvent('exampro:auth-changed',{detail:{uid:u.uid,email:u.email}}))}});}catch(e){console.warn('ExamPro authentication initialization failed',e)}})()}
})();
