import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { formatNPR, formatByCurrency } from './formatUtils'
import { formatDualDate } from './dateUtils'

const BRAND = {
  red: [232, 25, 44],
  black: [10, 10, 10],
  white: [255, 255, 255],
  gray: [136, 136, 136],
  lightGray: [240, 240, 240],
  border: [42, 42, 42],
}

/**
 * Generate Invoice PDF
 */
export function generateInvoicePDF(invoice, company, logoBase64) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  // ── Header background ──
  doc.setFillColor(...BRAND.black)
  doc.rect(0, 0, W, 55, 'F')

  // Logo
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 12, 10, 50, 20)
    } catch (e) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.setTextColor(...BRAND.white)
      doc.text('DebugDream', 12, 24)
    }
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(...BRAND.white)
    doc.text('DebugDream', 12, 24)
  }

  // Company info (right side of header)
  doc.setFontSize(7.5)
  doc.setTextColor(...BRAND.gray)
  doc.setFont('helvetica', 'normal')
  const companyLines = [
    company.name || 'debugdream',
    company.address || 'Old Baneshwor, Kathmandu, Nepal',
    `PAN: ${company.pan || '622445250'}`,
    `Reg: ${company.registration || '375208'}`,
    company.website || 'www.debugdream.com',
  ]
  let cy = 18
  companyLines.forEach(line => {
    doc.text(line, W - 12, cy, { align: 'right' })
    cy += 5
  })

  // Red accent bar
  doc.setFillColor(...BRAND.red)
  doc.rect(0, 55, W, 2, 'F')

  // ── Invoice label ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...BRAND.black)
  doc.text('INVOICE', 12, 72)

  // Invoice number and status
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...BRAND.gray)
  doc.text(`#${invoice.invoiceNumber}`, 12, 80)

  // Status badge
  const statusColors = {
    Draft: [245, 158, 11],
    Sent: [59, 130, 246],
    Paid: [34, 197, 94],
    Overdue: [239, 68, 68],
  }
  const statusColor = statusColors[invoice.status] || BRAND.gray
  doc.setFillColor(...statusColor)
  doc.roundedRect(W - 40, 65, 28, 8, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...BRAND.white)
  doc.text(invoice.status?.toUpperCase() || 'DRAFT', W - 26, 70.5, { align: 'center' })

  // Dates
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...BRAND.black)
  doc.text(`Issue Date: ${invoice.invoiceDate || ''}`, W - 12, 78, { align: 'right' })
  doc.text(`Due Date:   ${invoice.dueDate || ''}`, W - 12, 84, { align: 'right' })

  // ── Bill To ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...BRAND.gray)
  doc.text('BILL TO', 12, 95)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...BRAND.black)
  doc.text(invoice.clientName || '', 12, 102)

  if (invoice.clientAddress) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(80, 80, 80)
    doc.text(invoice.clientAddress, 12, 108)
  }

  // ── Line items table ──
  const items = invoice.lineItems || []
  const tableY = invoice.clientAddress ? 115 : 110

  doc.autoTable({
    startY: tableY,
    head: [['Description', 'Qty', 'Rate', 'Amount']],
    body: items.map(item => [
      item.description || '',
      item.qty?.toString() || '1',
      formatByCurrency(item.rate, invoice.currency),
      formatByCurrency((item.qty || 1) * (item.rate || 0), invoice.currency),
    ]),
    theme: 'plain',
    headStyles: {
      fillColor: BRAND.black,
      textColor: BRAND.white,
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
    },
    bodyStyles: {
      textColor: [40, 40, 40],
      fontSize: 8.5,
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 40, halign: 'right' },
      3: { cellWidth: 45, halign: 'right' },
    },
    margin: { left: 12, right: 12 },
    didDrawPage: (data) => {
      // Red accent line on each page
      doc.setDrawColor(...BRAND.red)
      doc.setLineWidth(0.3)
      doc.line(12, data.settings.startY - 1, W - 12, data.settings.startY - 1)
    }
  })

  // ── Totals ──
  const finalY = doc.lastAutoTable.finalY + 6
  const subtotal = items.reduce((s, i) => s + ((i.qty || 1) * (i.rate || 0)), 0)
  
  doc.setDrawColor(...BRAND.lightGray)
  doc.setLineWidth(0.3)
  doc.line(W - 80, finalY, W - 12, finalY)

  // Total box
  doc.setFillColor(...BRAND.black)
  doc.roundedRect(W - 80, finalY + 2, 68, 14, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...BRAND.gray)
  doc.text('TOTAL', W - 74, finalY + 9.5)
  doc.setFontSize(12)
  doc.setTextColor(...BRAND.white)
  doc.text(formatByCurrency(subtotal, invoice.currency), W - 14, finalY + 10.5, { align: 'right' })

  // ── Notes ──
  if (invoice.notes) {
    const notesY = finalY + 25
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...BRAND.gray)
    doc.text('NOTES / PAYMENT INSTRUCTIONS', 12, notesY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(80, 80, 80)
    const lines = doc.splitTextToSize(invoice.notes, W - 24)
    doc.text(lines, 12, notesY + 6)
  }

  // ── Footer ──
  doc.setFillColor(...BRAND.lightGray)
  doc.rect(0, H - 20, W, 20, 'F')
  doc.setFillColor(...BRAND.red)
  doc.rect(0, H - 20, 3, 20, 'F')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...BRAND.gray)
  doc.text(`PAN: ${company.pan || '622445250'} · Reg: ${company.registration || '375208'} · ${company.website || 'www.debugdream.com'}`, W / 2, H - 12, { align: 'center' })
  doc.text(`Generated by DebugDream Finance · ${new Date().toLocaleDateString()}`, W / 2, H - 7, { align: 'center' })

  doc.save(`${invoice.invoiceNumber || 'invoice'}.pdf`)
}

/**
 * Generate Payslip PDF
 */
export function generatePayslipPDF(employee, payroll, month, company, logoBase64) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  // Header
  doc.setFillColor(...BRAND.black)
  doc.rect(0, 0, W, 45, 'F')

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 12, 10, 40, 16)
    } catch (e) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(...BRAND.white)
      doc.text('DebugDream', 12, 22)
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...BRAND.gray)
  doc.text('SALARY PAYSLIP', W - 12, 18, { align: 'right' })
  doc.setFontSize(14)
  doc.setTextColor(...BRAND.white)
  doc.text(month || '', W - 12, 28, { align: 'right' })

  doc.setFillColor(...BRAND.red)
  doc.rect(0, 45, W, 1.5, 'F')

  // Employee info
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...BRAND.black)
  doc.text(employee.name || '', 12, 60)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...BRAND.gray)
  doc.text(employee.type === 'fulltime' ? 'Full-time Employee' : employee.type === 'intern' ? 'Intern' : 'Trainee', 12, 67)

  // ── Earnings ──
  doc.autoTable({
    startY: 75,
    head: [['Earnings', 'Amount']],
    body: [
      ['Basic Salary', formatNPR(payroll.basic)],
      ...(payroll.allowances || []).map(a => [a.name, formatNPR(a.amount)]),
    ],
    theme: 'plain',
    headStyles: { fillColor: [26, 26, 26], textColor: BRAND.white, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { textColor: [40, 40, 40], fontSize: 8.5 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: 12, right: W / 2 + 6 },
  })

  // ── Deductions ──
  doc.autoTable({
    startY: 75,
    head: [['Deductions', 'Amount']],
    body: [
      ['Employee SSF (11%)', formatNPR(payroll.employeeSSF)],
      ['Monthly TDS', formatNPR(payroll.monthlyTDS)],
    ],
    theme: 'plain',
    headStyles: { fillColor: [26, 26, 26], textColor: BRAND.white, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { textColor: [40, 40, 40], fontSize: 8.5 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: W / 2 + 6, right: 12 },
  })

  const detailsY = Math.max(doc.lastAutoTable.finalY, 105) + 8

  // ── Net Take-Home ──
  doc.setFillColor(...BRAND.black)
  doc.roundedRect(12, detailsY, W - 24, 20, 3, 3, 'F')
  doc.setFillColor(...BRAND.red)
  doc.roundedRect(12, detailsY, 5, 20, 3, 3, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND.gray)
  doc.text('NET TAKE-HOME', 24, detailsY + 7.5)
  doc.setFontSize(16)
  doc.setTextColor(...BRAND.white)
  doc.text(formatNPR(payroll.netPay), W - 16, detailsY + 11, { align: 'right' })

  // Employer SSF (informational)
  const empSsfY = detailsY + 28
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...BRAND.gray)
  doc.text(`Employer SSF Contribution (20%): ${formatNPR(payroll.employerSSF)} — paid by company directly to SSF`, 12, empSsfY)

  // Signature lines
  const sigY = H - 40
  doc.setDrawColor(...BRAND.border)
  doc.line(12, sigY, 70, sigY)
  doc.line(W - 70, sigY, W - 12, sigY)
  doc.setFontSize(7.5)
  doc.setTextColor(...BRAND.gray)
  doc.text('Employee Signature', 12, sigY + 5)
  doc.text('Authorized Signatory', W - 12, sigY + 5, { align: 'right' })

  // Footer
  doc.setFillColor(...BRAND.lightGray)
  doc.rect(0, H - 18, W, 18, 'F')
  doc.setFontSize(7)
  doc.setTextColor(...BRAND.gray)
  doc.text(`${company.name || 'debugdream'} · PAN: ${company.pan || '622445250'} · ${company.address || 'Old Baneshwor, Kathmandu'}`, W / 2, H - 10, { align: 'center' })
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, W / 2, H - 5, { align: 'center' })

  doc.save(`payslip-${employee.name}-${month?.replace(/\s/g, '-') || 'month'}.pdf`)
}
