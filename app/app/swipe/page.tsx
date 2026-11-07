import { redirect } from 'next/navigation';

/** The deck now lives in the middle of /app. */
export default function SwipePage() {
  redirect('/app');
}
