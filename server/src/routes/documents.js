const express = require('express');
const { getCase } = require('../lib/caseStore');
const { generatePdfBuffer } = require('../lib/documentGenerator');

const router = express.Router();

router.get('/:caseId', async (req, res) => {
  const storedCase = getCase(req.params.caseId);

  if (!storedCase) {
    return res.status(404).json({
      status: 'not_found',
      message: 'Case not found.',
    });
  }

  // Payment gate: Only allow document generation if payment is completed
  if (storedCase.paymentStatus !== 'paid') {
    return res.status(402).json({
      status: 'payment_required',
      message: 'Payment required before document generation.',
    });
  }

  try {
    const pdfBuffer = await generatePdfBuffer(storedCase.intake);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="deposit-defender-${storedCase.id}.pdf"`
    );
    return res.send(pdfBuffer);
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message:
        'Document generation is temporarily unavailable. Please try again later.',
    });
  }
});

module.exports = router;
