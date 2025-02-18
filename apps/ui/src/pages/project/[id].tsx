import { useRouter } from "next/router";

export default function ProjectPage() {
  const router = useRouter();
  const { id } = router.query;

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-4xl font-bold">Project: {id}</h1>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Back to Home
          </button>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-2xl font-semibold">Project Editor</h2>
          <p className="text-gray-600">
            Project editor will be implemented here.
          </p>
        </div>
      </div>
    </div>
  );
}
