import type { BotId } from '@/components/world/store';

export const AGENTS: { id: BotId; name: string; color: string; role: string }[] = [
  { id: 'concierge', name: 'Guide', color: '#6dbd13', role: 'Talks with you and runs the plan.' },
  { id: 'scout', name: 'Scout', color: '#3db8c9', role: 'Finds places and checks the neighborhood.' },
  { id: 'caller', name: 'Caller', color: '#ff8a4c', role: "Calls offices when they're open." },
  { id: 'packet', name: 'Packet', color: '#f2c230', role: 'Turns your documents into a renter packet.' },
  { id: 'closer', name: 'Closer', color: '#f25c8a', role: 'Gets the best deal and the keys.' },
];

export const AGENT_COLOR: Record<BotId, string> = Object.fromEntries(
  AGENTS.map((a) => [a.id, a.color]),
) as Record<BotId, string>;
