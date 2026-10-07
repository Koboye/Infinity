# Model licences and commercial use

Dimts the code is yours to license as you choose. The **AI models it downloads have their own licences**.
Personal, research and pilot use: fine. Selling it or running a paid service: set `DIMTS_COMMERCIAL=1`
and the app will refuse any model whose licence forbids commercial use.

| Model | Used for | Licence | Commercial use |
|---|---|---|---|
| whisper / faster-whisper | listening (all languages except best Amharic) | MIT | yes |
| facebook/nllb-200-distilled-600M | translation | CC-BY-NC 4.0 | no |
| facebook/mms-1b-all | listening to Amharic, Oromo, Tigrinya | CC-BY-NC 4.0 | no |
| facebook/mms-tts-amh / orm / tir | speaking Amharic, Oromo, Tigrinya | CC-BY-NC 4.0 | no |
| FreeVC (coqui freevc24) | copying a speaker's voice | MIT code; check the weights and training data | verify |
| XTTS v2 | voice cloning (not used by default) | Coqui Public Model Licence (non-commercial) | no |
| pyannote speaker-diarization-3.1 | telling speakers apart | MIT, gated: accept terms on Hugging Face | verify |
| resemblyzer | telling you from the other person | Apache 2.0 | yes |
| demucs | removing original voices | MIT | yes |
| yt-dlp | downloading links | Unlicense. Downloading content can breach a site's terms or copyright | verify |

## What you must do before charging money
1. **Replace the three non-commercial parts**: translation (NLLB), Ethiopian-language listening and speaking (MMS).
   Options: fine-tune your own models on data you own or license (this is also your moat), or use a paid cloud API
   whose terms allow resale. Nothing bundled here is both open and commercial-grade for Amharic today.
2. **Voice consent.** Only clone a voice you own or have written permission to use. Dimts asks for this before cloning
   and labels all output as AI-generated (file metadata). Keep that label.
3. **Recording consent.** Some countries and US states require every party's consent to record or translate a conversation.
   Tell people you are using a translator.
4. **Video rights.** Dubbing a video you do not own may infringe copyright; downloading may breach the site's terms.
5. Get a lawyer to confirm the "verify" rows above and your privacy policy.
