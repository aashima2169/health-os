export default function Header() {
  const today = new Date();

  const formattedDate = today.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <header className="mb-8">
      <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">
        Daily Check-in
      </p>

      <h1 className="mt-3 text-4xl font-bold text-slate-900">
        Good Morning
      </h1>

      <p className="mt-2 text-slate-500">{formattedDate}</p>
    </header>
  );
}