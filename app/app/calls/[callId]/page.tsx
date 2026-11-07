import { CallView } from '@/components/calls/CallView';
import type { Id } from '@/convex/_generated/dataModel';

export const metadata = { title: 'Call · how.zingg' };

export default async function CallPage({
  params,
}: {
  params: Promise<{ callId: string }>;
}) {
  const { callId } = await params;
  return <CallView callId={callId as Id<'calls'>} />;
}
