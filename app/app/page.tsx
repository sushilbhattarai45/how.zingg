import { TopNav } from '@/components/landing/TopNav';
import { Workspace } from '@/components/workspace/Workspace';

export const metadata = { title: 'Find your place · how.zingg' };

export default function AppPage() {
  return (
    <>
      <TopNav app />
      <main className="bg-ink">
        <Workspace />
      </main>
    </>
  );
}
