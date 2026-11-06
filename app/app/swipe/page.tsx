import { SwipeDeck } from '@/components/swipe/SwipeDeck';

export const metadata = { title: 'Find your place · how.zingg' };

export default function SwipePage() {
  return (
    <main className="bg-ink">
      <SwipeDeck />
    </main>
  );
}
