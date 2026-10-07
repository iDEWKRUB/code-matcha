// ดาวคะแนน (ทึบ = ได้คะแนน)
export const Star = ({ on, size = 36 }: { on: boolean; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path
      d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"
      fill={on ? "#E9A93A" : "#fff"}
      stroke={on ? "#B97A12" : "#C9CFBF"}
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

export default Star;
