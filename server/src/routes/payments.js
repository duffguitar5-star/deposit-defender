const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getCase, updateCasePaymentStatus, getCaseBySessionId } = require('../lib/caseStore');
const { PRODUCT_PRICE, PRODUCT_NAME, PRODUCT_DESCRIPTION, CURRENCY } = require('../config/pricing');
const { canAccessCase } = require('../middleware/sessionAuth');

const router = express.Router();

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';

router.post('/create-checkout-session', async (req, res) => {
  try {
    const { caseId } = req.body;

    if (!caseId) {
      return res.status(400).json({
        status: 'error',
        message: 'Case ID is required.',
      });
    }

    // Check session ownership
    if (!canAccessCase(req, caseId)) {
      return res.status(403).json({
        status: 'forbidden',
        message: 'Access denied. This case does not belong to your session.',
      });
    }

    const existingCase = getCase(caseId);

    if (!existingCase) {
      return res.status(404).json({
        status: 'not_found',
        message: 'Case not found.',
      });
    }

    if (existingCase.paymentStatus === 'paid') {
      return res.status(400).json({
        status: 'already_paid',
        message: 'This case has already been paid for.',
      });
    }

    // If there's already a pending session that hasn't expired, reuse it
    if (existingCase.stripeSessionId) {
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(existingCase.stripeSessionId);

        // If the session is still open (not expired), return it
        if (existingSession.status === 'open') {
          return res.status(200).json({
            status: 'ok',
            sessionId: existingSession.id,
            url: existingSession.url,
          });
        }
      } catch (error) {
        // Session not found or expired, create a new one
        console.log('Previous session not found or expired, creating new one');
      }
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: CURRENCY,
          product_data: {
            name: PRODUCT_NAME,
            description: PRODUCT_DESCRIPTION,
          },
          unit_amount: PRODUCT_PRICE,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${CLIENT_ORIGIN}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_ORIGIN}/payment/cancel?case_id=${caseId}`,
      metadata: {
        caseId: caseId,
      },
    });

    await updateCasePaymentStatus(caseId, {
      stripeSessionId: session.id,
    });

    return res.status(200).json({
      status: 'ok',
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Unable to create checkout session.',
    });
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (error) {
    console.error('Webhook signature verification failed:', error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const caseId = session.metadata.caseId;

      if (!caseId) {
        console.error('No caseId in session metadata');
        break;
      }

      const existingCase = getCase(caseId);

      if (!existingCase) {
        console.error(`Case not found for caseId: ${caseId}`);
        break;
      }

      await updateCasePaymentStatus(caseId, {
        paymentStatus: 'paid',
        paidAt: new Date().toISOString(),
        stripeSessionId: session.id,
      });

      console.log(`Payment completed for case: ${caseId}`);
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object;
      console.log(`Charge refunded: ${charge.id}`);
      // Future: Handle refund logic here
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return res.status(200).json({ received: true });
});

router.get('/verify/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        status: 'error',
        message: 'Session ID is required.',
      });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return res.status(404).json({
        status: 'not_found',
        message: 'Session not found.',
      });
    }

    let caseData = getCaseBySessionId(sessionId);

    if (!caseData) {
      return res.status(404).json({
        status: 'not_found',
        message: 'Case not found for this session.',
      });
    }

    // P0 Reconciliation: If Stripe says paid but local is pending, update local
    if (session.payment_status === 'paid' && caseData.paymentStatus === 'pending') {
      console.log(`Reconciling payment status for case: ${caseData.id}`);
      caseData = await updateCasePaymentStatus(caseData.id, {
        paymentStatus: 'paid',
        paidAt: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      status: 'ok',
      paymentStatus: session.payment_status,
      caseId: caseData.id,
      isPaid: caseData.paymentStatus === 'paid',
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Unable to verify payment.',
    });
  }
});

module.exports = router;
