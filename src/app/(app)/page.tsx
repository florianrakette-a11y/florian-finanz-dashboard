export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">Übersicht</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Monatsansicht Soll/Ist und anstehende Fälligkeiten – folgt in Phase 3.
        </p>
      </div>

      <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
        Sobald fixe Ausgaben, Rechnungen und Einnahmen erfasst sind, erscheint
        hier die Auswertung.
      </div>
    </div>
  );
}
