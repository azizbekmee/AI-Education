export default function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute -top-48 -left-48 h-[30rem] w-[30rem] rounded-full bg-violet-600/20 blur-3xl" />
      <div className="absolute top-1/3 -right-48 h-[32rem] w-[32rem] rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute -bottom-32 left-1/3 h-96 w-96 rounded-full bg-fuchsia-600/10 blur-3xl" />
    </div>
  );
}
