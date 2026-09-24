export default function Seal({ size }: { size: number }) {
  return (
    <span className="seal" aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      <span>暗号</span>
    </span>
  );
}
