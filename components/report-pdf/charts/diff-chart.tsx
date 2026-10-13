import { Line, Path, Rect, Svg } from "@react-pdf/renderer";
import type { Rally } from "@/lib/report/types";
import { COLORS } from "../theme";
import { diffGeometry } from "./geometry";

export function DiffChart({ rallies, width, height }: { rallies: Rally[]; width: number; height: number }) {
  const geometry = diffGeometry(rallies, width, height);
  return (
    <Svg width={width} height={height}>
      {geometry.bars.map((bar, i) => (
        <Rect key={i} x={bar.x} y={bar.y} width={bar.width} height={bar.height} fill={bar.side === "us" ? COLORS.us : COLORS.them} fillOpacity={0.18} />
      ))}
      <Line x1={0} y1={geometry.zeroY} x2={width} y2={geometry.zeroY} stroke={COLORS.grid} strokeWidth={0.5} />
      <Path d={geometry.path} stroke={COLORS.text} strokeWidth={0.8} fill="none" />
    </Svg>
  );
}
