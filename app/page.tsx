import { TopNav } from '@/components/landing/TopNav';
import { StoryScroller } from '@/components/landing/StoryScroller';
import { ForOffices } from '@/components/landing/ForOffices';
import { Facts, Faq, FinalCta, Footer } from '@/components/landing/StaticSections';

export default function LandingPage() {
  return (
    <>
      <TopNav />
      <main>
        <StoryScroller />
        <div className="theme-light bg-paper">
          <ForOffices />
          <Facts />
          <Faq />
          <FinalCta />
        </div>
      </main>
      <Footer />
    </>
  );
}
