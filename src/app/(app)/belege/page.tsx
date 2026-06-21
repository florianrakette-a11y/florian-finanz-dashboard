import { ReceiptScanner } from "./receipt-scanner";

export default function BelegePage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">Belege</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Rechnung fotografieren – Claude liest sie aus, du bestätigst, fertig.
        </p>
      </div>
      <ReceiptScanner />
    </div>
  );
}
