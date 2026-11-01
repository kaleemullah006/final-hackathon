// A very small PDF writer for one-page payslips. It uses the standard Helvetica fonts that every
// PDF reader has, so there is nothing to install or bundle. Characters outside Latin-1 (for example
// Urdu letters) cannot be drawn with these fonts and are shown as "?".

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;

function toLatin1(text) {
  return String(text ?? "")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

const num = (value) => Number(value.toFixed(2));

class PageBuilder {
  constructor() {
    this.ops = [];
  }

  // top is measured from the top of the page, like on screen
  text(x, top, value, { size = 11, bold = false, align = "left", width = 0 } = {}) {
    const safe = toLatin1(value);
    let left = x;
    if (align === "right") {
      // Helvetica is roughly 0.52 of the font size wide per character
      left = x + width - safe.length * size * 0.52;
    }
    this.ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${num(left)} ${num(PAGE_HEIGHT - top)} Td (${safe}) Tj ET`);
  }

  line(x1, top1, x2, top2, thickness = 0.7) {
    this.ops.push(`${thickness} w ${num(x1)} ${num(PAGE_HEIGHT - top1)} m ${num(x2)} ${num(PAGE_HEIGHT - top2)} l S`);
  }

  rect(x, top, width, height, grey) {
    this.ops.push(`${grey} g ${num(x)} ${num(PAGE_HEIGHT - top - height)} ${num(width)} ${num(height)} re f 0 g`);
  }

  build() {
    const stream = Buffer.from(this.ops.join("\n"), "latin1");
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        "/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    ];

    const parts = [Buffer.from("%PDF-1.4\n", "latin1")];
    const offsets = [];
    let length = parts[0].length;

    const add = (buffer) => {
      parts.push(buffer);
      length += buffer.length;
    };

    objects.forEach((body, index) => {
      offsets.push(length);
      add(Buffer.from(`${index + 1} 0 obj\n${body}\nendobj\n`, "latin1"));
    });

    offsets.push(length);
    add(Buffer.from(`6 0 obj\n<< /Length ${stream.length} >>\nstream\n`, "latin1"));
    add(stream);
    add(Buffer.from("\nendstream\nendobj\n", "latin1"));

    const xrefStart = length;
    let xref = `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
    xref += `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
    add(Buffer.from(xref, "latin1"));

    return Buffer.concat(parts);
  }
}

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// payslip: a payslip document, company: company name, draft: true when the run is not final yet
function buildPayslipPdf({ payslip, companyName, draft }) {
  const page = new PageBuilder();
  const left = 50;
  const right = PAGE_WIDTH - 50;
  const width = right - left;

  page.rect(0, 0, PAGE_WIDTH, 80, 0.14);
  page.ops.push("1 g"); // white text on the dark band
  page.text(left, 44, companyName || "HCM Lite", { size: 20, bold: true });
  page.text(left, 64, "Payslip", { size: 12 });
  page.text(right - 160, 54, payslip.month, { size: 16, bold: true, align: "right", width: 160 });
  page.ops.push("0 g"); // back to black

  if (draft) {
    page.text(left, 102, "DRAFT: this payroll has not been finalized yet", { size: 10, bold: true });
  }

  const info = [
    ["Employee", payslip.snapshot.name],
    ["Employee code", payslip.snapshot.code],
    ["Department", payslip.snapshot.department || "-"],
    ["Designation", payslip.snapshot.designation || "-"],
  ];
  let top = 130;
  for (const [label, value] of info) {
    page.text(left, top, label, { size: 10 });
    page.text(left + 110, top, value, { size: 11, bold: true });
    top += 20;
  }

  top += 14;
  const column = (x, title) => page.text(x, top, title, { size: 12, bold: true });
  column(left, "Earnings");
  column(left + 280, "Deductions");
  top += 6;
  page.line(left, top, left + 240, top);
  page.line(left + 280, top, right, top);
  top += 18;

  const earnings = [
    ["Basic salary", payslip.basic],
    ["House rent allowance (40%)", payslip.hra],
    ["Medical allowance (10%)", payslip.medical],
  ];
  const deductions = [
    [`Attendance (${payslip.deductionDays} day(s))`, payslip.deductionAmount],
    ["Income tax", payslip.tax],
  ];
  const rows = Math.max(earnings.length, deductions.length);
  for (let i = 0; i < rows; i++) {
    if (earnings[i]) {
      page.text(left, top, earnings[i][0], { size: 10 });
      page.text(left, top, money(earnings[i][1]), { size: 10, align: "right", width: 240 });
    }
    if (deductions[i]) {
      page.text(left + 280, top, deductions[i][0], { size: 10 });
      page.text(left + 280, top, money(deductions[i][1]), { size: 10, align: "right", width: right - left - 280 });
    }
    top += 20;
  }

  top += 4;
  page.line(left, top, left + 240, top);
  page.line(left + 280, top, right, top);
  top += 18;
  page.text(left, top, "Gross salary", { size: 11, bold: true });
  page.text(left, top, money(payslip.gross), { size: 11, bold: true, align: "right", width: 240 });
  page.text(left + 280, top, "Total deductions", { size: 11, bold: true });
  page.text(left + 280, top, money(payslip.deductionAmount + payslip.tax), {
    size: 11,
    bold: true,
    align: "right",
    width: right - left - 280,
  });

  top += 36;
  page.rect(left, top - 20, width, 40, 0.92);
  page.text(left + 14, top + 5, "Net pay", { size: 14, bold: true });
  page.text(left, top + 5, `PKR ${money(payslip.net)}`, { size: 16, bold: true, align: "right", width: width - 14 });

  top += 56;
  page.text(left, top, "How the deduction was worked out", { size: 11, bold: true });
  top += 18;
  const notes = [
    `Working days in the month: ${payslip.workingDays}. Pay per day: ${money(payslip.perDay)}.`,
    `Absent days: ${payslip.absentDays}. Unpaid leave days: ${payslip.unpaidDays}. Half days: ${payslip.halfDays} (counted as 0.5 each).`,
    `Days before joining or after leaving: ${payslip.notEmployedDays}.`,
    `Tax is worked out on the yearly gross (gross x 12 = ${money(payslip.gross * 12)}), divided by 12.`,
  ];
  for (const note of notes) {
    page.text(left, top, note, { size: 9 });
    top += 15;
  }

  page.line(left, 790, right, 790, 0.4);
  page.text(left, 806, "This is a computer-generated payslip.", { size: 8 });

  return page.build();
}

module.exports = { buildPayslipPdf };
