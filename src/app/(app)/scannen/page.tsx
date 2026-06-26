import { Scanner } from "./scanner";

export default function ScannenPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">Belege scannen</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Rechnung/Beleg fotografieren → wird als PDF gespeichert, einsortiert und an Buchhaltungsbutler übertragen.
        </p>
      </div>
      <Scanner />
    </div>
  );
}
