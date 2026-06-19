"use client";

export function DeleteButton({
  action,
  id,
}: {
  action: (formData: FormData) => void;
  id: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Diesen Eintrag wirklich löschen?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-sm font-medium text-red-600 hover:text-red-700">
        Löschen
      </button>
    </form>
  );
}
