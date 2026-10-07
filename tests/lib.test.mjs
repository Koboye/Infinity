import { checkTranslation, checkLabel } from '../src/lib/dimts/quality.js';
import { validateLink } from '../src/lib/dimts/safety.js';
import { normalize, lookup, fixWords } from './memstub.mjs';
const t = (n, ok) => console.log(ok ? 'PASS' : 'FAIL', n);
t('empty -> no translation', checkTranslation('Hello', '')[0] === 'no translation');
t('latin output flagged', checkTranslation('Hello there my friend', 'hello there').includes('not Amharic script'));
t('good line passes', checkLabel(checkTranslation('Hello, how are you today?', 'ሰላም እንዴት ነህ ዛሬ')) === '✓');
t('loop flagged', checkTranslation('Hello there friend', 'ሰላም ሰላም ሰላም ሰላም ሰላም ሰላም').includes('repeating words'));
t('numbers missing', checkTranslation('I have 5 apples today', 'ፖም አለኝ ዛሬ').includes('numbers missing'));
for (const u of ['http://169.254.169.254/x','http://127.0.0.1','file:///etc/passwd','http://10.0.0.5/a','http://[::1]/']) {
  try { await validateLink(u); t('block '+u, false); } catch { t('block '+u, true); } }
try { await validateLink('https://1.1.1.1/video.m3u8'); t('allow public ip', true); } catch (e) { t('allow public ip', false); }
t('normalize ignores case/punct', normalize('Hello,  HOW are you?!') === 'hello how are you');
const f = { lines: { [normalize('Hello, how are you?')]: { src:'x', am:'ሰላም' } }, words: { 'አአ':'ለ', 'አአአ':'መ' } };
t('line lookup', lookup(f, 'hello how are you') === 'ሰላም');
t('longest word fix first', fixWords(f, 'አአአ') === 'መ');
