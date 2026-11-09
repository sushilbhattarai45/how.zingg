import { TopNav } from '@/components/landing/TopNav';
import { RoommateSpace } from '@/components/roommates/RoommateSpace';

export const metadata = { title: 'Roommate Space · how.zingg' };

export default function RoommatesPage() {
  return (
    <>
      <TopNav app />
      <main className="min-h-dvh bg-ink">
        <RoommateSpace />
      </main>
    </>
  );
}
