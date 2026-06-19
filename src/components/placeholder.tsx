export function Placeholder({
  title,
  hint,
}: {
  title: string;
  hint: string;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-neutral-900">{title}</h2>
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
        {hint}
      </div>
    </div>
  );
}
