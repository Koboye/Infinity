import GebetaApp from '@/components/GebetaApp';

// Preserve the original Gebeta, Dama, Bingo and game modes in a dedicated route.
// Infinity's main / route remains the student sign-in experience.
export default function BoardGamesPage() {
  return <GebetaApp />;
}
