export function StateLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="state-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

