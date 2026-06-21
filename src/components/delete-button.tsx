"use client";

export function DeleteButton({
  action,
  id,
  name,
}: {
  action: (formData: FormData) => void;
  id: string;
  name?: string;
}) {
  const message = name ? `„${name}" wirklich löschen?` : "Diesen Eintrag wirklich löschen?";
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-sm font-medium text-red-600 hover:text-red-700">
        Löschen
      </button>
    </form>
  );
}
