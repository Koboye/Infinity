'use client';
import React, { useRef, useState } from 'react';
import { usePhoto, storePhoto, photoFromFile } from '@/lib/photo';
import { heroById } from '@/lib/i18n';

const TX = {
  en: { title: 'Profile picture', sub: 'Shown on your Ludo card and on your Dama king. It stays on this device (and on your account when you are signed in).', pick: 'Choose photo', change: 'Change photo', remove: 'Remove', bad: 'That file is not a usable picture.', big: 'That picture is too large.', saved: 'Saved' },
  am: { title: 'የመገለጫ ፎቶ', sub: 'በሉዶ ካርድህ እና በዳማ ንጉሥህ ላይ ይታያል። በዚህ መሣሪያ ላይ ይቀመጣል (ከገባህ በመለያህም ላይ)።', pick: 'ፎቶ ምረጥ', change: 'ፎቶ ቀይር', remove: 'አስወግድ', bad: 'ይህ ፋይል ተስማሚ ፎቶ አይደለም።', big: 'ፎቶው በጣም ትልቅ ነው።', saved: 'ተቀምጧል' },
};

/** Pick a photo from the gallery or camera. `onChange(dataUrl|null)` lets the profile save it to the account too. */
export default function PhotoPicker({ lang, heroId, onChange }) {
  const t = TX[lang === 'am' ? 'am' : 'en'];
  const photo = usePhoto(); const ref = useRef(null);
  const [msg, setMsg] = useState('');
  const pick = async (e) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    try { const url = await photoFromFile(f); storePhoto(url); onChange?.(url); setMsg(t.saved); setTimeout(() => setMsg(''), 1500); }
    catch (err) { setMsg(err.message === 'too-big' ? t.big : t.bad); }
  };
  const hero = heroById(heroId);
  return (
    <section className="photo-pick" aria-label={t.title}>
      <div className="pp-face" style={photo ? undefined : { background: hero.color }}>{photo ? <img src={photo} alt="" /> : <span aria-hidden="true">{hero.glyph}</span>}</div>
      <div className="pp-txt">
        <b>{t.title}</b><small>{t.sub}</small>
        <div className="pp-acts">
          <button type="button" className="btn" onClick={() => ref.current?.click()}>{photo ? t.change : t.pick}</button>
          {photo && <button type="button" className="btn ghost" onClick={() => { storePhoto(null); onChange?.(null); }}>{t.remove}</button>}
        </div>
        {msg && <small className="pp-msg" role="status">{msg}</small>}
      </div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={pick} />
    </section>
  );
}
