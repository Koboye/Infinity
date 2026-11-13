# Amharic Bingo caller clips (optional)

Run `python tools/generate-bingo-audio.py` (needs internet and `pip install edge-tts`) to create them here, or add your own recordings with the same names:

- One clip per call: `B1.mp3` … `B15.mp3`, `I16.mp3` … `I30.mp3`, `N31.mp3` … `N45.mp3`, `G46.mp3` … `G60.mp3`, `O61.mp3` … `O75.mp3` (75 files, each says the letter and the number, e.g. B12 = "ቢ አስራ ሁለት")
- Announcements: `START.mp3` (game begins), `BINGO.mp3` (someone shouts BINGO), `WINNER.mp3` (you win)

Without these files the caller uses an Amharic text-to-speech voice if the phone has one, otherwise it reads the ball in English.
