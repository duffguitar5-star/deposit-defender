const express = require('express');

const router = express.Router();

router.post('/', (req, res) => {
  return res.status(501).json({
    status: 'not_configured',
    message: 'Payment processing is not configured yet.',
  });
});

module.exports = router;
