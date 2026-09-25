"use client";

import Cup from "../Cup";

export default function PosterCups() {
  return (
    <div className="poster-cups" aria-hidden="true">
      <Cup itemId="usucha" temp="iced" milk={null} size={84} />
      <Cup itemId="strawberry-matcha" temp="iced" milk="fresh" size={100} />
      <Cup itemId="cold-whisk-latte" temp="iced" milk="fresh" size={84} />
      <Cup itemId="matcha-latte" temp="hot" milk="fresh" size={84} />
    </div>
  );
}
