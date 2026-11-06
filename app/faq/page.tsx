import { DocPage, Mail, type DocSection } from '@/components/legal/DocPage';
import { FAQ_GROUPS } from '@/content/faq';

export const metadata = {
  title: 'FAQ · how.zingg',
  description: 'Answers about SSNs, AI calls, documents, money, scams and roommates.',
};

const sections: DocSection[] = FAQ_GROUPS.map((g) => ({
  id: g.id,
  title: g.title,
  body: (
    <div className="divide-y divide-line rounded-[16px] border border-line bg-card">
      {g.items.map((f) => (
        <details key={f.q} className="group px-4">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 font-bold text-chalk">
            {f.q}
            <span
              aria-hidden
              className="text-[20px] text-text-3 transition-transform duration-250 group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p className="pb-4">{f.a}</p>
        </details>
      ))}
    </div>
  ),
}));

export default function FaqPage() {
  return (
    <DocPage
      eyebrow="FAQ"
      title="Questions, answered"
      intro={
        <p>
          Everything students and leasing offices ask us. Something missing? Email <Mail />.
        </p>
      }
      sections={sections}
      numbered={false}
    />
  );
}
