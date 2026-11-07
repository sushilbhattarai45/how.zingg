import { MyPlaces } from '@/components/places/MyPlaces';

export const metadata = { title: 'My places · how.zingg' };

export default function MyPlacesPage() {
  return (
    <main className="bg-ink">
      <MyPlaces />
    </main>
  );
}
