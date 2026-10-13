import { Text, View } from "@react-pdf/renderer";
import { COLORS, styles } from "./theme";

export interface Column {
  label: string;
  width: number;
  align?: "left" | "right" | "center";
}

const DEFAULT_ROWS_PER_BLOCK = 24;

/**
 * Rows are drawn in blocks that never split across pages; each block repeats the header.
 * The title sits inside the first block, so it never stays alone at the bottom of a page.
 */
export function Table({
  title,
  columns,
  rows,
  footer,
  rowsPerBlock = DEFAULT_ROWS_PER_BLOCK,
}: {
  title?: string;
  columns: Column[];
  rows: string[][];
  footer?: string[];
  rowsPerBlock?: number;
}) {
  const blocks: string[][][] = [];
  for (let i = 0; i < Math.max(rows.length, 1); i += rowsPerBlock) blocks.push(rows.slice(i, i + rowsPerBlock));
  return (
    <View>
      {blocks.map((block, b) => (
        <View key={b} wrap={false} style={{ marginBottom: b === blocks.length - 1 ? 0 : 4 }}>
          {b === 0 && title ? <Text style={styles.h2}>{title}</Text> : null}
          <Row columns={columns} cells={columns.map((column) => column.label)} header />
          {block.map((cells, i) => (
            <Row key={i} columns={columns} cells={cells} zebra={i % 2 === 1} />
          ))}
          {footer && b === blocks.length - 1 ? <Row columns={columns} cells={footer} header /> : null}
        </View>
      ))}
    </View>
  );
}

const align = (column: Column, i: number) => column.align ?? (i === 0 ? "left" : "right");

function Row({ columns, cells, header = false, zebra = false }: { columns: Column[]; cells: string[]; header?: boolean; zebra?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: header ? COLORS.header : zebra ? COLORS.zebra : "#ffffff",
        borderBottomWidth: 0.5,
        borderBottomColor: COLORS.grid,
        paddingVertical: 2,
      }}
    >
      {columns.map((column, i) => (
        <Text key={i} style={{ width: column.width, paddingLeft: align(column, i) === "left" && i > 0 ? 8 : 2, paddingRight: 2, textAlign: align(column, i), fontWeight: header ? 700 : 400 }}>
          {cells[i] ?? ""}
        </Text>
      ))}
    </View>
  );
}
