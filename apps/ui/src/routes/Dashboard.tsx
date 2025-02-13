import { PLCValue, Quality } from '@inrush/protocol';
import { usePLCConnection } from '../hooks/usePLCConnection';

const DEMO_TAGS = ['Temperature', 'Pressure', 'Flow', 'Level'];

export function Dashboard() {
  const values = usePLCConnection({ tags: DEMO_TAGS });

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-sm text-gray-700">
            Real-time overview of your PLC variables.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {DEMO_TAGS.map((tag) => (
          <PLCValueCard key={tag} tag={tag} value={values[tag]} />
        ))}
      </div>
    </div>
  );
}

interface PLCValueCardProps {
  tag: string;
  value?: PLCValue;
}

function PLCValueCard({ tag, value }: PLCValueCardProps) {
  const quality = value?.quality || Quality.Uncertain;
  const timestamp = value?.timestamp
    ? new Date(value.timestamp).toLocaleTimeString()
    : '-';

  return (
    <div className={`bg-white overflow-hidden shadow rounded-lg ${
      quality === Quality.Good ? 'border-green-500' : 'border-red-500'
    } border-t-4`}>
      <div className="px-4 py-5 sm:p-6">
        <dt className="text-sm font-medium text-gray-500 truncate">{tag}</dt>
        <dd className="mt-1 text-3xl font-semibold text-gray-900">
          {value?.value ?? '-'}
        </dd>
        <div className="mt-4">
          <span className="text-sm text-gray-500">{timestamp}</span>
        </div>
      </div>
    </div>
  );
}
