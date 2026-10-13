import { ReportCardRecord } from "../types";

/**
 * Generates a valid standard PDF (PDF-1.4) document for a student report card
 * without requiring heavy external native dependencies.
 */
export function generateReportCardPdf(report: ReportCardRecord): Buffer {
  const { student, class_group, assessments, overall_grade, overall_percentage } = report;

  // Build clean text content lines for the PDF
  const title = "MUCONO COLLEGIATE ACADEMY - OFFICIAL REPORT CARD";
  const session = "Academic Session: 2026 - 2027";
  const studentInfo = `Student: ${student.full_name}   |   Roll Number: ${student.roll_number}   |   Cohort: ${class_group?.name || "General"}`;
  const standing = `Overall Performance: Grade ${overall_grade} (${overall_percentage !== null ? `${overall_percentage}%` : "Incomplete"})`;

  const rowsText = assessments.map((a, i) => {
    const scoreStr = a.is_missing ? "Absent / Pending" : `${a.raw_score} / ${a.max_marks}`;
    const pctStr = a.percentage !== null ? `${a.percentage}%` : "—";
    return `${i + 1}. ${a.assessment.title} [${a.assessment.subject}]: ${scoreStr} (${pctStr}) - Grade: ${a.grade_band}`;
  });

  const notice = "Notice: Deterministic score calculation applied. Missing assessments are recorded as absent/pending rather than zero.";
  const signoff = "Teacher Sign-off: Dr. Eleanor Vance            Registrar: St. Jude Collegiate Academy";

  // Assemble minimal valid PDF 1.4 objects
  let streamContent = `BT\n/F1 16 Tf\n50 750 Td\n(${escapePdfText(title)}) Tj\nET\n`;
  streamContent += `BT\n/F1 10 Tf\n50 730 Td\n(${escapePdfText(session)}) Tj\nET\n`;
  streamContent += `BT\n/F1 11 Tf\n50 700 Td\n(${escapePdfText(studentInfo)}) Tj\nET\n`;
  streamContent += `BT\n/F1 11 Tf\n50 680 Td\n(${escapePdfText(standing)}) Tj\nET\n`;

  // Draw separator line
  streamContent += `0.5 w\n50 665 m\n550 665 l\nS\n`;

  // Assessment rows
  streamContent += `BT\n/F1 12 Tf\n50 645 Td\n(EXAMINATION RECORDS & EVALUATED MARKS:) Tj\nET\n`;

  let y = 625;
  for (const row of rowsText) {
    streamContent += `BT\n/F1 10 Tf\n50 ${y} Td\n(${escapePdfText(row)}) Tj\nET\n`;
    y -= 20;
  }

  y -= 15;
  streamContent += `0.5 w\n50 ${y + 5} m\n550 ${y + 5} l\nS\n`;
  y -= 15;
  streamContent += `BT\n/F1 8 Tf\n50 ${y} Td\n(${escapePdfText(notice)}) Tj\nET\n`;

  y -= 45;
  streamContent += `BT\n/F1 10 Tf\n50 ${y} Td\n(${escapePdfText(signoff)}) Tj\nET\n`;

  const streamLength = Buffer.byteLength(streamContent, "utf-8");

  const pdfParts: string[] = [];
  pdfParts.push("%PDF-1.4\n");
  pdfParts.push("%\xE2\xE3\xCF\xD3\n");

  const offsets: number[] = [];

  function addObj(content: string) {
    offsets.push(Buffer.byteLength(pdfParts.join(""), "utf-8"));
    pdfParts.push(content);
  }

  // Obj 1: Catalog
  addObj("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // Obj 2: Pages
  addObj("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

  // Obj 3: Page
  addObj("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n");

  // Obj 4: Stream
  addObj(`4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`);

  // Obj 5: Font
  addObj("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  const xrefOffset = Buffer.byteLength(pdfParts.join(""), "utf-8");
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${off.toString().padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  pdfParts.push(xref);
  pdfParts.push(trailer);

  return Buffer.from(pdfParts.join(""), "utf-8");
}

function escapePdfText(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
