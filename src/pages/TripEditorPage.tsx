import { Link, useParams } from 'react-router-dom';
import { useTripEditor } from './useTripEditor';
import ContextPanel from '../components/ContextPanel';
import Checklist from '../components/Checklist';
import SuggestionsTray from '../components/SuggestionsTray';

export default function TripEditorPage() {
  const { tripId } = useParams();
  const { trip, status, update } = useTripEditor(tripId);

  if (status === 'loading') {
    return <p className="text-slate-500">Loading…</p>;
  }

  if (status === 'not-found' || !trip) {
    return (
      <div className="card p-6 text-center">
        <p className="text-slate-600">Trip not found.</p>
        <Link to="/" className="btn-secondary mt-3">
          Back to trips
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link to="/" className="btn-ghost mb-3 -ml-3 print:hidden">
        ← All trips
      </Link>
      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <ContextPanel trip={trip} update={update} />
        <div className="flex flex-col gap-4">
          <SuggestionsTray trip={trip} update={update} />
          <Checklist trip={trip} update={update} />
        </div>
      </div>
    </div>
  );
}
