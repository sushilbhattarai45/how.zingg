'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowUp,
  Home,
  MapPin,
  MessageCircle,
  Search,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  DEMO_CONNECTED_IDS,
  ROOMMATE_PEOPLE,
  ROOMMATE_THREADS,
  monthDay,
  searchRoommateRequests,
  type RoommateMsg,
  type RoommatePerson,
} from '@/content/roommateSpace';

const EASE = [0.2, 0.8, 0.2, 1] as const;

type Tab = 'connections' | 'chats';
type FindMode = 'roommate' | 'colease';

function timeLabel(at: number) {
  return new Date(at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function Avatar({ name, online }: { name: string; online?: boolean }) {
  return (
    <span className="relative shrink-0">
      <span className="grid size-11 place-items-center rounded-full bg-raised text-[15px] font-extrabold text-chalk">
        {name.slice(0, 1)}
      </span>
      {online && (
        <span
          className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-surface bg-window"
          aria-hidden
        />
      )}
    </span>
  );
}

/**
 * Roommate Space: Connections (find / search) first → Chat after you connect.
 * Demo-only; lifestyle matching fields only.
 */
export function RoommateSpace() {
  const [tab, setTab] = useState<Tab>('connections');
  const [findMode, setFindMode] = useState<FindMode>('roommate');
  const [query, setQuery] = useState('USM');
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<RoommatePerson[]>([]);
  const [connected, setConnected] = useState<Set<string>>(
    () => new Set(DEMO_CONNECTED_IDS),
  );
  const [selected, setSelected] = useState(DEMO_CONNECTED_IDS[0] ?? '');
  const [threads, setThreads] = useState<Record<string, RoommateMsg[]>>(() =>
    structuredClone(ROOMMATE_THREADS),
  );
  const [draft, setDraft] = useState('');
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [postedNote, setPostedNote] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  const connectedPeople = useMemo(
    () => ROOMMATE_PEOPLE.filter((p) => connected.has(p.id)),
    [connected],
  );

  const person = useMemo(
    () => connectedPeople.find((p) => p.id === selected) ?? connectedPeople[0] ?? null,
    [connectedPeople, selected],
  );
  const messages = person ? (threads[person.id] ?? []) : [];

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages.length, selected]);

  const runSearch = (e?: FormEvent) => {
    e?.preventDefault();
    const list = searchRoommateRequests({
      query,
      kind: findMode === 'roommate' ? 'roommate' : 'colease',
    });
    setResults(list);
    setSearched(true);
    setPostedNote(null);
  };

  const connect = (id: string) => {
    setConnected((prev) => new Set(prev).add(id));
    setSelected(id);
    setTab('chats');
    setMobileShowChat(true);
    setThreads((prev) => {
      if (prev[id]?.length) return prev;
      const p = ROOMMATE_PEOPLE.find((x) => x.id === id);
      return {
        ...prev,
        [id]: [
          {
            id: `hello-${id}`,
            from: 'them',
            text: `Hi! Thanks for connecting — happy to chat about ${p?.lookingFor ?? 'sharing a place'}.`,
            at: Date.now(),
          },
        ],
      };
    });
  };

  const postMyRequest = () => {
    setPostedNote(
      findMode === 'roommate'
        ? 'Your “find a roommate” request is live (demo). Others near this zip/uni can discover you.'
        : 'Your co-lease request is live (demo). Matching students searching this location will see it.',
    );
  };

  const send = () => {
    if (!person) return;
    const text = draft.trim();
    if (!text) return;
    const next: RoommateMsg = {
      id: `local-${Date.now()}`,
      from: 'you',
      text,
      at: Date.now(),
    };
    setThreads((prev) => ({
      ...prev,
      [person.id]: [...(prev[person.id] ?? []), next],
    }));
    setDraft('');
    window.setTimeout(() => {
      setThreads((prev) => ({
        ...prev,
        [person.id]: [
          ...(prev[person.id] ?? []),
          {
            id: `demo-reply-${Date.now()}`,
            from: 'them',
            text: 'Got it — demo chat only. Real Roommate Space would stay on lifestyle tags (budget, habits, move-in).',
            at: Date.now(),
          },
        ],
      }));
    }, 900);
  };

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-4 pt-20 pb-6 lg:h-[calc(100dvh-0.5rem)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[12px] font-bold tracking-wide text-window uppercase">
            <Users size={14} aria-hidden /> Roommate Space
          </p>
          <h1 className="mt-1 text-[26px] leading-8 font-extrabold tracking-tight">
            Connections first, then chat
          </h1>
          <p className="mt-1 max-w-2xl text-[14px] leading-5 text-text-2">
            Search by zip, university, or location · connect on a request · then message. Lifestyle
            tags only.{' '}
            <span className="rounded-full bg-raised px-2 py-0.5 text-[12px] font-bold text-text-3">
              Example
            </span>
          </p>
        </div>
        <Link
          href="/app"
          className="flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[13px] font-bold hover:bg-raised"
        >
          <ArrowLeft size={14} aria-hidden /> Back to places
        </Link>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Roommate Space sections"
        className="flex gap-1 rounded-[16px] border border-line bg-surface p-1"
      >
        <TabBtn
          active={tab === 'connections'}
          onClick={() => {
            setTab('connections');
            setMobileShowChat(false);
          }}
          icon={<Search size={15} aria-hidden />}
          label="Connections"
          hint="Find & search"
        />
        <TabBtn
          active={tab === 'chats'}
          onClick={() => setTab('chats')}
          icon={<MessageCircle size={15} aria-hidden />}
          label="Chats"
          hint={`${connectedPeople.length} connected`}
        />
      </div>

      {tab === 'connections' ? (
        <ConnectionsPanel
          findMode={findMode}
          setFindMode={setFindMode}
          query={query}
          setQuery={setQuery}
          onSearch={runSearch}
          onPost={postMyRequest}
          postedNote={postedNote}
          searched={searched}
          results={results}
          connected={connected}
          onConnect={connect}
          onOpenChat={(id) => {
            setSelected(id);
            setTab('chats');
            setMobileShowChat(true);
          }}
        />
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside
            aria-label="Connected chats"
            className={`min-h-0 flex-col overflow-hidden rounded-[20px] border border-line bg-surface ${
              mobileShowChat ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <div className="border-b border-line px-4 py-3">
              <p className="font-bold">Your chats</p>
              <p className="text-[12px] text-text-3">
                Connect from Connections first · {connectedPeople.length} open
              </p>
            </div>
            {connectedPeople.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <UserPlus className="text-text-3" size={28} aria-hidden />
                <p className="text-[14px] font-semibold text-text-2">No connections yet</p>
                <button
                  type="button"
                  onClick={() => setTab('connections')}
                  className="rounded-full bg-window px-4 py-2 text-[13px] font-bold text-ink"
                >
                  Find people
                </button>
              </div>
            ) : (
              <ul className="flex-1 overflow-y-auto p-2">
                {connectedPeople.map((p) => {
                  const last = threads[p.id]?.[threads[p.id]!.length - 1];
                  const active = p.id === person?.id;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(p.id);
                          setMobileShowChat(true);
                        }}
                        className={`flex w-full gap-3 rounded-[16px] px-3 py-3 text-left transition ${
                          active ? 'bg-window-dim/50 ring-1 ring-window/40' : 'hover:bg-raised/70'
                        }`}
                      >
                        <Avatar name={p.name} online={p.online} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate font-bold">{p.name}</span>
                            {p.unread ? (
                              <span className="grid min-w-5 place-items-center rounded-full bg-window px-1.5 text-[11px] font-extrabold text-ink">
                                {p.unread}
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 line-clamp-1 text-[12px] text-text-3">
                            {last?.text ?? p.lookingFor}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          {person ? (
            <ChatPane
              person={person}
              messages={messages}
              draft={draft}
              setDraft={setDraft}
              onSend={send}
              endRef={end}
              showMobile={mobileShowChat}
              onBack={() => setMobileShowChat(false)}
            />
          ) : (
            <div className="hidden min-h-[400px] place-items-center rounded-[20px] border border-dashed border-line lg:grid">
              <p className="text-[14px] text-text-3">Select a connection to chat</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[12px] px-3 text-[14px] font-bold transition ${
        active ? 'bg-window-dim text-good ring-1 ring-window/40' : 'text-text-2 hover:bg-raised'
      }`}
    >
      {icon}
      <span className="flex flex-col items-start leading-tight">
        <span>{label}</span>
        <span className="text-[11px] font-semibold text-text-3">{hint}</span>
      </span>
    </button>
  );
}

function ConnectionsPanel({
  findMode,
  setFindMode,
  query,
  setQuery,
  onSearch,
  onPost,
  postedNote,
  searched,
  results,
  connected,
  onConnect,
  onOpenChat,
}: {
  findMode: FindMode;
  setFindMode: (m: FindMode) => void;
  query: string;
  setQuery: (q: string) => void;
  onSearch: (e?: FormEvent) => void;
  onPost: () => void;
  postedNote: string | null;
  searched: boolean;
  results: RoommatePerson[];
  connected: Set<string>;
  onConnect: (id: string) => void;
  onOpenChat: (id: string) => void;
}) {
  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_1.1fr]">
      <section className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-5">
        <div>
          <h2 className="text-[18px] font-extrabold">What are you looking for?</h2>
          <p className="mt-1 text-[13px] text-text-3">
            Post a request or search open ones by zip, university, or area.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <ModeCard
            active={findMode === 'roommate'}
            onClick={() => setFindMode('roommate')}
            icon={<UserPlus size={20} className="text-window" aria-hidden />}
            title="Find a roommate"
            body="Someone to share a place you’re still choosing."
          />
          <ModeCard
            active={findMode === 'colease'}
            onClick={() => setFindMode('colease')}
            icon={<Home size={20} className="text-scout" aria-hidden />}
            title="Co-lease opportunity"
            body="Split a specific listing or building near campus."
          />
        </div>

        <form onSubmit={onSearch} className="space-y-3">
          <label className="grid gap-1.5">
            <span className="text-[12px] font-bold text-text-2">Zip · university · location</span>
            <span className="flex items-center gap-2 rounded-full border border-line bg-raised px-3">
              <MapPin size={16} className="text-text-3" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. 39401, USM, Hattiesburg, Magnolia"
                className="h-12 min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:text-text-3"
              />
            </span>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-window text-[14px] font-extrabold text-ink"
            >
              <Search size={16} aria-hidden /> Search requests
            </button>
            <button
              type="button"
              onClick={onPost}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-line bg-raised text-[14px] font-bold hover:border-window"
            >
              <UserPlus size={16} aria-hidden /> Post my request
            </button>
          </div>
          <p className="text-[11px] leading-4 text-text-3">
            Try <button type="button" className="font-bold text-window underline" onClick={() => setQuery('39401')}>39401</button>
            {', '}
            <button type="button" className="font-bold text-window underline" onClick={() => setQuery('USM')}>USM</button>
            {', or '}
            <button type="button" className="font-bold text-window underline" onClick={() => setQuery('Magnolia')}>Magnolia</button>
            .
          </p>
        </form>

        {postedNote && (
          <p className="rounded-[14px] border border-window/40 bg-window-dim/40 px-4 py-3 text-[13px] font-semibold text-good">
            {postedNote}
          </p>
        )}
      </section>

      <section className="flex min-h-[420px] flex-col overflow-hidden rounded-[20px] border border-line bg-surface">
        <div className="border-b border-line px-5 py-3">
          <p className="font-bold">
            {findMode === 'roommate' ? 'Roommate requests' : 'Co-lease opportunities'}
          </p>
          <p className="text-[12px] text-text-3">
            {searched
              ? `${results.length} match${results.length === 1 ? '' : 'es'} · connect to unlock chat`
              : 'Search to see open requests'}
          </p>
        </div>
        <ul className="flex-1 space-y-2 overflow-y-auto p-3">
          {!searched && (
            <li className="grid h-full min-h-[280px] place-items-center px-6 text-center">
              <div>
                <Search className="mx-auto text-text-3" size={28} aria-hidden />
                <p className="mt-3 text-[14px] font-semibold text-text-2">
                  Enter a zip, uni, or location to find people
                </p>
              </div>
            </li>
          )}
          {searched && results.length === 0 && (
            <li className="grid min-h-[200px] place-items-center px-6 text-center text-[14px] text-text-3">
              No requests for that filter — try USM or 39401.
            </li>
          )}
          {results.map((p) => {
            const isConnected = connected.has(p.id);
            return (
              <li
                key={p.id}
                className="rounded-[16px] border border-line bg-raised/30 px-4 py-3"
              >
                <div className="flex gap-3">
                  <Avatar name={p.name} online={p.online} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{p.name}</p>
                      <span className="rounded-full bg-raised px-2 py-0.5 text-[11px] font-bold text-text-3">
                        Example
                      </span>
                      <span className="rounded-full bg-ink/50 px-2 py-0.5 text-[11px] font-bold text-text-2">
                        {p.kind === 'colease' ? 'Co-lease' : 'Roommate'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[13px] text-text-2">{p.program}</p>
                    <p className="mt-1 text-[13px] font-semibold">{p.lookingFor}</p>
                    <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[12px] text-text-3">
                      <span>
                        {p.university} · {p.city} {p.zip}
                      </span>
                      {p.placeHint && <span>· {p.placeHint}</span>}
                      <span>
                        · ${p.budgetMin}–{p.budgetMax} · {monthDay(p.moveIn)}
                      </span>
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-raised px-2 py-0.5 text-[11px] font-bold text-text-2"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {isConnected ? (
                        <button
                          type="button"
                          onClick={() => onOpenChat(p.id)}
                          className="flex min-h-9 items-center gap-1.5 rounded-full bg-window px-3 text-[12px] font-bold text-ink"
                        >
                          <MessageCircle size={13} aria-hidden /> Open chat
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onConnect(p.id)}
                          className="flex min-h-9 items-center gap-1.5 rounded-full border border-window/50 bg-window-dim px-3 text-[12px] font-bold text-good"
                        >
                          <UserPlus size={13} aria-hidden /> Connect
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[16px] border px-4 py-3 text-left transition ${
        active ? 'border-window bg-window-dim/40 ring-1 ring-window/30' : 'border-line bg-raised/40 hover:border-chalk/40'
      }`}
    >
      <span className="flex items-center gap-2">
        {icon}
        <span className="font-bold">{title}</span>
      </span>
      <span className="mt-1 block text-[12px] leading-4 text-text-3">{body}</span>
    </button>
  );
}

function ChatPane({
  person,
  messages,
  draft,
  setDraft,
  onSend,
  endRef,
  showMobile,
  onBack,
}: {
  person: RoommatePerson;
  messages: RoommateMsg[];
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  endRef: RefObject<HTMLDivElement | null>;
  showMobile: boolean;
  onBack: () => void;
}) {
  return (
    <section
      aria-label={`Chat with ${person.name}`}
      className={`min-h-[520px] flex-col overflow-hidden rounded-[20px] border border-line bg-surface lg:min-h-0 ${
        showMobile ? 'flex' : 'hidden lg:flex'
      }`}
    >
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <button
          type="button"
          className="grid size-9 place-items-center rounded-full border border-line lg:hidden"
          aria-label="Back to list"
          onClick={onBack}
        >
          <ArrowLeft size={16} />
        </button>
        <Avatar name={person.name} online={person.online} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">
            {person.name}{' '}
            <span className="ml-1 rounded-full bg-raised px-2 py-0.5 text-[11px] font-bold text-text-3">
              Example
            </span>
          </p>
          <p className="truncate text-[12px] text-text-3">
            {person.program} · ${person.budgetMin}–{person.budgetMax} · {monthDay(person.moveIn)}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-2.5">
        <span className="rounded-full bg-raised px-2.5 py-1 text-[11px] font-bold text-text-2">
          {person.lookingFor}
        </span>
        {person.tags.map((t) => (
          <span key={t} className="rounded-full bg-raised px-2.5 py-1 text-[11px] font-bold text-text-2">
            {t}
          </span>
        ))}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        <p className="mx-auto mb-3 max-w-[280px] text-center text-[11px] leading-4 text-text-3">
          Connected · lifestyle chat only
        </p>
        <AnimatePresence initial={false}>
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const showTime = !prev || m.at - prev.at > 5 * 60 * 1000;
            const mine = m.from === 'you';
            return (
              <div key={m.id}>
                {showTime && (
                  <p className="my-3 text-center text-[11px] font-bold text-text-3">
                    {timeLabel(m.at)}
                  </p>
                )}
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: EASE }}
                  className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-[18px] px-3.5 py-2.5 text-[14px] leading-5 font-semibold ${
                      mine
                        ? 'rounded-br-[6px] bg-window text-ink'
                        : 'rounded-bl-[6px] bg-raised text-chalk'
                    }`}
                  >
                    {m.text}
                  </div>
                </motion.div>
              </div>
            );
          })}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
        className="flex items-center gap-2 border-t border-line p-3"
      >
        <label htmlFor="rm-msg" className="sr-only">
          Message {person.name}
        </label>
        <input
          id="rm-msg"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about budget, habits, move-in…"
          className="h-10 min-w-0 flex-1 rounded-full bg-raised px-4 text-[14px] font-semibold outline-none placeholder:text-text-3 focus:ring-2 focus:ring-line"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!draft.trim()}
          className="grid size-10 shrink-0 place-items-center rounded-full text-chalk hover:bg-raised disabled:text-text-3"
        >
          <ArrowUp size={18} strokeWidth={2.5} />
        </button>
      </form>
    </section>
  );
}
