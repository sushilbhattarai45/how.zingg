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
        <ForOffices />
        <Facts />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
