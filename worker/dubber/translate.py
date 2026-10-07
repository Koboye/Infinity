"""Step C: translate the transcript into Amharic."""
from __future__ import annotations

import json
import urllib.parse
import urllib.request

from . import config, licences

# Whisper language code -> NLLB language code
NLLB_CODES = {
    "en": "eng_Latn", "tr": "tur_Latn", "es": "spa_Latn", "fr": "fra_Latn", "de": "deu_Latn",
    "it": "ita_Latn", "pt": "por_Latn", "ru": "rus_Cyrl", "ar": "arb_Arab", "hi": "hin_Deva",
    "zh": "zho_Hans", "ja": "jpn_Jpan", "ko": "kor_Hang", "nl": "nld_Latn", "pl": "pol_Latn",
    "sw": "swh_Latn", "am": "amh_Ethi", "om": "gaz_Latn", "ti": "tir_Ethi", "fa": "pes_Arab", "ur": "urd_Arab", "id": "ind_Latn", "uk": "ukr_Cyrl",
}
NLLB_MODEL = "facebook/nllb-200-distilled-600M"
_cache = {}


def _load_nllb():
    if "m" not in _cache:
        licences.require("facebook/nllb-200-distilled-600M")
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        device = config.pick_device()
        _cache["tok"] = AutoTokenizer.from_pretrained(NLLB_MODEL)
        _cache["m"] = AutoModelForSeq2SeqLM.from_pretrained(NLLB_MODEL).to(device).eval()
        _cache["dev"] = device
    return _cache["tok"], _cache["m"], _cache["dev"]


def translate_nllb(texts: list[str], source_lang: str, target_code: str = "amh_Ethi", batch: int = 8,
                   strict: bool = False) -> list[str]:
    """Offline neural translation with Meta's NLLB-200 (supports Amharic natively)."""
    import torch
    tok, model, device = _load_nllb()
    tok.src_lang = NLLB_CODES.get(source_lang, "eng_Latn")
    out: list[str] = []
    for i in range(0, len(texts), batch):
        enc = tok(texts[i:i + batch], return_tensors="pt", padding=True, truncation=True, max_length=256).to(device)
        with torch.no_grad():
            gen = model.generate(**enc, forced_bos_token_id=tok.convert_tokens_to_ids(target_code),
                                 num_beams=8 if strict else 4, max_new_tokens=256,
                                 **({"no_repeat_ngram_size": 3, "repetition_penalty": 1.25} if strict else {}))
        out += tok.batch_decode(gen, skip_special_tokens=True)
    return out


def translate_google(texts: list[str], source_lang: str, target: str = "am") -> list[str]:
    """Online fallback using Google's public endpoint (no key, may be rate-limited)."""
    out = []
    for t in texts:
        url = ("https://translate.googleapis.com/translate_a/single?client=gtx"
               f"&sl={source_lang or 'auto'}&tl={target}&dt=t&q={urllib.parse.quote(t)}")
        with urllib.request.urlopen(url, timeout=20) as r:
            data = json.loads(r.read().decode("utf-8"))
        out.append("".join(p[0] for p in data[0] if p and p[0]) or t)
    return out


def _machine_translate(texts: list[str], source_lang: str, engine: str) -> list[str]:
    if engine == "google":
        return translate_google(texts, source_lang)
    try:
        out = translate_nllb(texts, source_lang)
        from . import quality
        bad = [i for i, (t, o) in enumerate(zip(texts, out))
               if {"no translation", "not Amharic script", "repeating words"} & set(quality.check_translation(t, o))]
        if bad:                                     # try again, more carefully, only for the broken lines
            for i, o in zip(bad, translate_nllb([texts[i] for i in bad], source_lang, strict=True)):
                out[i] = o
        return out
    except Exception as exc:                         # e.g. model download blocked
        print(f"[translate] NLLB failed ({exc}); falling back to online translation")
        return translate_google(texts, source_lang)


def translate(texts: list[str], source_lang: str, engine: str = "nllb", use_memory: bool = True) -> list[str]:
    """Translate to Amharic. Sentences you corrected before come straight from memory (never wrong again);
    the rest go to the AI, then your word fixes are applied on top."""
    if not texts:
        return []
    if not use_memory:
        return _machine_translate(texts, source_lang, engine)
    from . import memory
    mem = memory.get()
    out: list[str | None] = [mem.lookup(t) for t in texts]
    todo = [i for i, o in enumerate(out) if o is None]
    if todo:
        for i, t in zip(todo, _machine_translate([texts[i] for i in todo], source_lang, engine)):
            out[i] = mem.fix_words(t)
    return [o or "" for o in out]
