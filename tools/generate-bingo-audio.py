"""Makes the Amharic Bingo caller clips with Microsoft's neural voice (needs internet): pip install edge-tts, then
    python tools/generate-bingo-audio.py
Writes B1.mp3 ... O75.mp3 plus START.mp3, BINGO.mp3, WINNER.mp3 into public/audio/bingo/am/, where the game finds them.
Listen to a few before shipping: have an Amharic speaker confirm the voice reads the numbers naturally."""
import asyncio
import os
import edge_tts

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "audio", "bingo", "am")
os.makedirs(OUTPUT_DIR, exist_ok=True)

ONES = ["", "አንድ", "ሁለት", "ሶስት", "አራት", "አምስት", "ስድስት", "ሰባት", "ስምንት", "ዘጠኝ"]
TENS = ["", "አስር", "ሃያ", "ሰላሳ", "አርባ", "ሃምሳ", "ስልሳ", "ሰባ"]
LETTERS = [("B", "ቢ", 1, 15), ("I", "አይ", 16, 30), ("N", "ኤን", 31, 45), ("G", "ጂ", 46, 60), ("O", "ኦ", 61, 75)]


def number(n):
    if n < 10:
        return ONES[n]
    if n == 10:
        return TENS[1]
    if n < 20:
        return f"አስራ {ONES[n % 10]}"
    return f"{TENS[n // 10]} {ONES[n % 10]}".strip()


# B1 ... O75: letter + number, exactly as the caller says it
BINGO_CALLS = {f"{L}{n}": f"{am} {number(n)}" for L, am, lo, hi in LETTERS for n in range(lo, hi + 1)}
BINGO_CALLS.update({
    "START": "ጨዋታው ተጀምሯል፣ መልካም እድል!",
    "BINGO": "ቢንጎ! ካርቴላዎን ያረጋግጡ።",
    "WINNER": "እንኳን ደስ አለዎት! አሸናፊ ተገኝቷል።",
})


async def main():
    voice = "am-ET-MekdesNeural"  # female; male: "am-ET-AmehaNeural"
    for code, text in BINGO_CALLS.items():
        path = os.path.join(OUTPUT_DIR, f"{code}.mp3")
        if os.path.exists(path) and os.path.getsize(path) > 0:
            continue  # already made: delete the file to redo it
        await edge_tts.Communicate(text, voice).save(path)
        print("Created:", path)


if __name__ == "__main__":
    asyncio.run(main())
