import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { formatByCurrency } from './formatUtils'
import { BS_MONTHS, AD_MONTHS } from './dateUtils'
import { SIGNATURE_BASE64 } from './signature.js'

const BRAND = {
  red: [232, 25, 44],
  black: [10, 10, 10],
  white: [255, 255, 255],
  offWhite: [248, 248, 248],
  gray: [120, 120, 120],
  darkGray: [60, 60, 60],
  lightGray: [240, 240, 240],
  border: [42, 42, 42],
}

// ─── Invoice PDF ──────────────────────────────────────────────────────────────
export function generateInvoicePDF(invoice, company, logoBase64, mode = 'download') {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  // ── Header — white background so any logo variant is visible ─────────────
  // ── Header Background & Accent ──────────────────────────────────────────
  doc.setFillColor(...BRAND.red)
  doc.rect(0, 0, W, 2, 'F')
  
  doc.setFillColor(...BRAND.offWhite)
  doc.rect(0, 2, W, 50, 'F')

  // Logo — Proportional Scaling
  if (logoBase64) {
    try {
      const imgProps = doc.getImageProperties(logoBase64)
      const maxWidth = 55
      const maxHeight = 22
      const imageRatio = imgProps.width / imgProps.height
      
      let displayWidth = maxWidth
      let displayHeight = maxWidth / imageRatio
      
      if (displayHeight > maxHeight) {
        displayHeight = maxHeight
        displayWidth = maxHeight * imageRatio
      }
      
      doc.addImage(logoBase64, 'PNG', 14, 12, displayWidth, displayHeight, undefined, 'FAST')
    } catch (e) {
      console.warn('Logo processing failed, using text fallback', e)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(24)
      doc.setTextColor(...BRAND.black)
      doc.text('DebugDream', 14, 28)
      doc.setFontSize(8)
      doc.setTextColor(...BRAND.red)
      doc.text('FINANCE', 14, 34)
    }
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(24)
    doc.setTextColor(...BRAND.black)
    doc.text('DebugDream', 14, 28)
    doc.setFontSize(8)
    doc.setTextColor(...BRAND.red)
    doc.text('FINANCE', 14, 34)
  }

  // Company Details (Right Aligned)
  doc.setFontSize(7.5)
  doc.setTextColor(...BRAND.darkGray)
  doc.setFont('helvetica', 'normal')
  const companyLines = [
    company.address || 'Old Baneshwor, Kathmandu, Nepal',
    `PAN: ${company.pan || '622445250'}`,
    `Reg: ${company.registration || '375208'}`,
    company.website || 'www.debugdream.com',
    company.contactNumber || '+977-9843812308',
  ]
  companyLines.forEach((line, i) => {
    doc.text(line, W - 14, 18 + i * 5, { align: 'right' })
  })

  // ── Invoice Label + Number ───────────────────────────────────────────────
  doc.setFillColor(...BRAND.black)
  doc.rect(14, 62, 45, 12, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...BRAND.white)
  doc.text('INVOICE', 36.5, 70, { align: 'center' })

  doc.setFontSize(9)
  doc.setTextColor(...BRAND.black)
  doc.text(`# ${invoice.invoiceNumber || ''}`, W - 14, 70, { align: 'right' })

  // Horizontal divider
  doc.setDrawColor(...BRAND.lightGray)
  doc.setLineWidth(0.2)
  doc.line(14, 78, W - 14, 78)

  // Meta Info Grid (aligned differently for variety/beauty)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...BRAND.gray)
  doc.text('DATE OF ISSUE', 14, 86)
  doc.text('DUE DATE', 54, 86)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND.black)
  doc.text(invoice.invoiceDate || '', 14, 92)
  doc.text(invoice.dueDate || 'On Receipt', 54, 92)

  // Service Period (displayed with emphasis)
  if (invoice.servicePeriodStart) {
    const isNPR = invoice.currency === 'NPR'
    const monthsArr = isNPR ? BS_MONTHS : AD_MONTHS
    let periodText = ''
    const startMonth = monthsArr[invoice.servicePeriodStart.month - 1]
    const startYear = invoice.servicePeriodStart.year
    if (invoice.servicePeriodEnd) {
      const endMonth = monthsArr[invoice.servicePeriodEnd.month - 1]
      periodText = `${startMonth} - ${endMonth} ${startYear}`
    } else {
      periodText = `${startMonth} ${startYear}`
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...BRAND.gray)
    doc.text('SERVICE PERIOD', W - 14, 86, { align: 'right' })
    doc.setFontSize(9)
    doc.setTextColor(...BRAND.black)
    doc.text(periodText, W - 14, 92, { align: 'right' })
  }

  // ── Bill To ───────────────────────────────────────────────────────────────
  let nextY = 110
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...BRAND.gray)
  doc.text('BILL TO', 14, nextY)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...BRAND.black)
  doc.text(invoice.clientName || '', 14, nextY + 7)

  nextY += 13
  
  if (invoice.clientPersonName) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...BRAND.darkGray)
    doc.text(`Attn: ${invoice.clientPersonName}`, 14, nextY)
    nextY += 5
  }

  if (invoice.clientAddress) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...BRAND.darkGray)
    const addrLines = doc.splitTextToSize(invoice.clientAddress, 80)
    doc.text(addrLines, 14, nextY)
    nextY += (addrLines.length * 5.2) + 2
  }

  let tableStartY = nextY + 2

  // ── Line items table ──────────────────────────────────────────────────────
  const items = invoice.lineItems || []
  doc.autoTable({
    startY: tableStartY + 4,
    head: [['Description', 'Qty', 'Rate', 'Amount']],
    body: items.map(item => [
      item.description || '',
      String(item.qty || 1),
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
      textColor: BRAND.darkGray,
      fontSize: 8.5,
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
    },
    alternateRowStyles: { fillColor: BRAND.offWhite },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 42, halign: 'right' },
      3: { cellWidth: 42, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  })

  // ── Total block ───────────────────────────────────────────────────────────
  let finalY = doc.lastAutoTable.finalY + 10

  // Summary logic
  const summaryX = W - 75
  const rowH = 7
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND.darkGray)
  doc.text('Subtotal:', summaryX, finalY)
  doc.text(formatByCurrency(invoice.subtotal, invoice.currency), W - 14, finalY, { align: 'right' })
  
  if (invoice.discount > 0) {
    finalY += rowH
    doc.text('Discount:', summaryX, finalY)
    doc.text(`- ${formatByCurrency(invoice.discount, invoice.currency)}`, W - 14, finalY, { align: 'right' })
  }
  
  if (invoice.tax > 0) {
    finalY += rowH
    doc.text(`Tax (${invoice.taxRate}%):`, summaryX, finalY)
    doc.text(formatByCurrency(invoice.tax, invoice.currency), W - 14, finalY, { align: 'right' })
  }

  // Final Total Block
  finalY += rowH + 2
  doc.setFillColor(...BRAND.black)
  doc.rect(summaryX - 5, finalY - 5, 75 + 5, 14, 'F')
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...BRAND.white)
  doc.text('TOTAL DUE', summaryX, finalY + 4)
  
  doc.setFontSize(12)
  doc.text(formatByCurrency(invoice.total, invoice.currency), W - 14, finalY + 4, { align: 'right' })
  
  finalY += 20 // Space after totals

  // Notes area
  if (invoice.notes) {
    const notesY = finalY
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...BRAND.gray)
    doc.text('NOTES / PAYMENT INSTRUCTIONS', 14, notesY)
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...BRAND.darkGray)
    const lines = doc.splitTextToSize(invoice.notes, W - 90) // Wrap notes to avoid overlapping signature
    doc.text(lines, 14, notesY + 6)
  }

  // ── Signature (Bottom Right) ─────────────────────────────────────────────
  const sigBlockY = H - 55
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...BRAND.gray)
  doc.text('AUTHORISED SIGNATURE', W - 14, sigBlockY, { align: 'right' })

  try {
    if (SIGNATURE_BASE64 && SIGNATURE_BASE64.length > 50) {
      const cleanSig = SIGNATURE_BASE64.trim()
      try {
        const sigProps = doc.getImageProperties(cleanSig)
        const sigMaxWidth = 48
        const sigMaxHeight = 18
        const sigRatio = sigProps.width / sigProps.height
        
        let sigW = sigMaxWidth
        let sigH = sigMaxWidth / sigRatio
        
        if (sigH > sigMaxHeight) {
          sigH = sigMaxHeight
          sigW = sigMaxHeight * sigRatio
        }

        doc.addImage(cleanSig, 'PNG', W - 14 - sigW, sigBlockY + 1, sigW, sigH, undefined, 'FAST')
      } catch (propsError) {
        console.warn('Signature properties failed, using fallback metrics', propsError)
        doc.addImage(cleanSig, 'PNG', W - 52, sigBlockY + 1, 38, 14, undefined, 'FAST')
      }
    } else {
      doc.setFontSize(8)
      doc.setTextColor(...BRAND.red)
      doc.text('[ Signature Missing ]', W - 14, sigBlockY + 10, { align: 'right' })
    }
  } catch (e) {
    console.error('Final signature rendering failure:', e)
    doc.setFontSize(8)
    doc.setTextColor(...BRAND.red)
    doc.text('[ Signature Load Error ]', W - 14, sigBlockY + 10, { align: 'right' })
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND.black)
  doc.text('Rikesh Karmacharya', W - 14, sigBlockY + 20, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...BRAND.darkGray)
  doc.text('Company CEO', W - 14, sigBlockY + 24, { align: 'right' })

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFillColor(...BRAND.offWhite)
  doc.rect(0, H - 20, W, 20, 'F')
  doc.setFillColor(...BRAND.black)
  doc.rect(0, H - 20, W, 0.5, 'F')
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...BRAND.gray)
  doc.text(
    `PAN: ${company.pan || '622445250'} · Reg: ${company.registration || '375208'} · ${company.website || 'www.debugdream.com'}`,
    W / 2, H - 12, { align: 'center' }
  )
  doc.setFont('helvetica', 'italic')
  doc.text(`This is a computer-generated document. Generated on ${new Date().toLocaleDateString()}`, W / 2, H - 7, { align: 'center' })

  if (mode === 'download') {
    doc.save(`${invoice.invoiceNumber || 'invoice'}.pdf`)
  } else if (mode === 'blob' || mode === 'preview') {
    return doc.output('bloburl')
  }
}

// ─── Payslip PDF ──────────────────────────────────────────────────────────────
export function generatePayslipPDF(employee, payroll, month, company, logoBase64) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  // Header — white so logo is visible
  doc.setFillColor(...BRAND.offWhite)
  doc.rect(0, 0, W, 48, 'F')
  doc.setFillColor(...BRAND.red)
  doc.rect(0, 0, 4, 48, 'F')

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 14, 10, 42, 18)
    } catch {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.setTextColor(...BRAND.black)
      doc.text('DebugDream', 14, 24)
    }
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...BRAND.black)
    doc.text('DebugDream', 14, 24)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...BRAND.gray)
  doc.text('SALARY PAYSLIP', W - 12, 18, { align: 'right' })
  doc.setFontSize(14)
  doc.setTextColor(...BRAND.black)
  doc.text(month || '', W - 12, 29, { align: 'right' })

  doc.setFillColor(...BRAND.red)
  doc.rect(0, 48, W, 1.5, 'F')

  // Employee info
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...BRAND.black)
  doc.text(employee.name || '', 14, 63)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...BRAND.gray)
  const typeLabel = employee.type === 'fulltime' ? 'Full-time Employee' : employee.type === 'intern' ? 'Intern' : 'Trainee'
  doc.text(typeLabel, 14, 70)

  // Earnings / Deductions tables side by side
  doc.autoTable({
    startY: 78,
    head: [['Earnings', 'Amount']],
    body: [
      ['Basic Salary', formatNPR(payroll.basic)],
      ...(payroll.allowances || []).map(a => [a.name, formatNPR(a.amount)]),
      ['Gross Pay', formatNPR(payroll.grossPay)],
    ],
    theme: 'plain',
    headStyles: { fillColor: BRAND.black, textColor: BRAND.white, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { textColor: BRAND.darkGray, fontSize: 8.5 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: 14, right: W / 2 + 6 },
  })

  doc.autoTable({
    startY: 78,
    head: [['Deductions', 'Amount']],
    body: [
      ['Employee SSF (11%)', formatNPR(payroll.employeeSSF)],
      ['Monthly TDS', employee.isOwner ? 'On withdrawal' : formatNPR(payroll.monthlyTDS)],
    ],
    theme: 'plain',
    headStyles: { fillColor: BRAND.black, textColor: BRAND.white, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { textColor: BRAND.darkGray, fontSize: 8.5 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: W / 2 + 6, right: 14 },
  })

  // Employer Contributions / CTC Section
  const costY = Math.max(doc.lastAutoTable.finalY, 108) + 8
  doc.autoTable({
    startY: costY,
    head: [['Employer Contributions & Cost to Company', 'Amount']],
    body: [
      ['Employer SSF (20%)', formatNPR(payroll.employerSSF)],
      ['Total CTC (Cost to Company)', { content: formatNPR(payroll.totalCTC), styles: { fontStyle: 'bold', textColor: BRAND.red } }],
    ],
    theme: 'plain',
    headStyles: { fillColor: BRAND.darkGray, textColor: BRAND.white, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { textColor: BRAND.darkGray, fontSize: 8.5 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  })

  // Net take-home banner
  const bannerY = doc.lastAutoTable.finalY + 8
  doc.setFillColor(...BRAND.black)
  doc.roundedRect(14, bannerY, W - 28, 22, 3, 3, 'F')
  doc.setFillColor(...BRAND.red)
  doc.roundedRect(14, bannerY, 5, 22, 3, 3, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND.gray)
  doc.text('NET TAKE-HOME', 26, bannerY + 8.5)
  doc.setFontSize(17)
  doc.setTextColor(...BRAND.white)
  doc.text(formatNPR(payroll.netPay), W - 18, bannerY + 12, { align: 'right' })

  // Note
  const noteY = bannerY + 30
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...BRAND.gray)
  doc.text(
    'Note: Employer contributions are paid by the company directly to the respective authorities and are part of your Total CTC.',
    14, noteY
  )

  // Signature lines
  const sigY = H - 42
  doc.setDrawColor(...BRAND.lightGray)
  doc.line(14, sigY, 75, sigY)
  doc.line(W - 75, sigY, W - 14, sigY)
  doc.setFontSize(7.5)
  doc.setTextColor(...BRAND.gray)
  doc.text('Employee Signature', 14, sigY + 5)
  doc.text('Authorised Signatory', W - 14, sigY + 5, { align: 'right' })

  // Footer
  doc.setFillColor(...BRAND.lightGray)
  doc.rect(0, H - 20, W, 20, 'F')
  doc.setFontSize(7)
  doc.setTextColor(...BRAND.gray)
  doc.text(
    `${company.name || 'debugdream'} · PAN: ${company.pan || '622445250'} · ${company.address || 'Old Baneshwor, Kathmandu'}`,
    W / 2, H - 11, { align: 'center' }
  )
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, W / 2, H - 5, { align: 'center' })

  doc.save(`payslip-${(employee.name || 'employee').replace(/\s/g, '-')}-${(month || 'month').replace(/\s/g, '-')}.pdf`)
}
