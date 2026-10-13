import { Circle, G, Line, Path, Rect, Svg, Text, View } from "@react-pdf/renderer";
import type { SetReport } from "@/lib/report/build";
import { COLORS, PAGE_WIDTH } from "../theme";
import { commentNumbers, diffGeometry, eventMarker, rallyLetter } from "./geometry";

const MARKER_HEIGHT = 12;
const CHART_HEIGHT = 90;
const STRIP_HEIGHT = 12;
const HEIGHT = MARKER_HEIGHT + CHART_HEIGHT + STRIP_HEIGHT;

/** Score difference per rally, one coloured cell per rally with its ending letter, and the set's events on the same axis. */
export function Timeline({ set, width = PAGE_WIDTH }: { set: SetReport; width?: number }) {
  const geometry = diffGeometry(set.rallies, width, CHART_HEIGHT);
  const numbers = commentNumbers(set.events);
  const stripY = MARKER_HEIGHT + CHART_HEIGHT;
  return (
    <View style={{ position: "relative", width, height: HEIGHT }}>
      <Svg width={width} height={HEIGHT}>
        <G transform={`translate(0, ${MARKER_HEIGHT})`}>
          {geometry.bars.map((bar, i) => (
            <Rect key={i} x={bar.x} y={bar.y} width={bar.width} height={bar.height} fill={bar.side === "us" ? COLORS.us : COLORS.them} fillOpacity={0.18} />
          ))}
          <Line x1={0} y1={geometry.zeroY} x2={width} y2={geometry.zeroY} stroke={COLORS.grid} strokeWidth={0.5} />
          <Path d={geometry.path} stroke={COLORS.text} strokeWidth={0.9} fill="none" />
        </G>
        {set.events.map((event) => {
          const x = event.afterRally * geometry.step;
          return <Line key={event.eventId} x1={x} y1={MARKER_HEIGHT} x2={x} y2={stripY} stroke={COLORS.muted} strokeWidth={0.5} strokeDasharray="2,2" />;
        })}
        {set.rallies.map((rally, i) => (
          <G key={i}>
            <Rect x={i * geometry.step} y={stripY + 1} width={Math.max(geometry.step - 0.4, 0.4)} height={STRIP_HEIGHT - 4} fill={rally.winner === "us" ? COLORS.us : COLORS.them} />
            {rally.server === "us" ? <Circle cx={i * geometry.step + geometry.step / 2} cy={stripY + STRIP_HEIGHT - 1.5} r={0.9} fill={COLORS.us} /> : null}
          </G>
        ))}
      </Svg>
      {set.events.map((event) => (
        <Text key={event.eventId} style={{ position: "absolute", left: Math.max(event.afterRally * geometry.step - 2, 0), top: 0, fontSize: 7 }}>
          {eventMarker(event.type, numbers.get(event.eventId) ?? 0)}
        </Text>
      ))}
      {geometry.step >= 6
        ? set.rallies.map((rally, i) => (
            <Text
              key={i}
              style={{ position: "absolute", left: i * geometry.step, top: stripY + 1.5, width: geometry.step, fontSize: 5, color: "#ffffff", textAlign: "center" }}
            >
              {rallyLetter(rally)}
            </Text>
          ))
        : null}
    </View>
  );
}
