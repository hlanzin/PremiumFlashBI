import { C } from "../theme";

export default function SkeletonRows({ count = 6, height = 30 }) {
  return (
    <div style={{ padding: "16px" }}>
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          style={{
            height: `${height}px`,
            background: C.rowEven,
            borderRadius: "4px",
            marginBottom: "6px",
            animation: "pulse 1.5s ease-in-out infinite",
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}
