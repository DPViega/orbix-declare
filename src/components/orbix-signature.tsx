export function OrbixSignature({ text }: { text: string }) {
  const marker = "orbix. lab";
  const index = text.indexOf(marker);
  if (index < 0) return <>{text}</>;

  return (
    <>
      {text.slice(0, index)}orbix<span className="text-gold">.</span>{" "}
      <span className="text-[#b3a0f4]">lab</span>
      {text.slice(index + marker.length)}
    </>
  );
}
