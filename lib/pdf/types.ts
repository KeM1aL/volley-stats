import { jsPDF } from "jspdf";
import { Set } from "@/lib/types";

export interface PdfExportHandle {
  generatePdfContent: (
    doc: jsPDF,
    initialYOffset: number,
    allSets: Set[],
    tabTitle: string
  ) => Promise<number>;
}
