const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const templatePath = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'ai',
  'FIRST DOCUMENT TEMPLATE.txt'
);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value) {
  if (!value) return '';
  return value;
}

function buildLandlordAddress(landlordInfo) {
  if (!landlordInfo) return '';
  const parts = [
    landlordInfo.landlord_address,
    [landlordInfo.landlord_city, landlordInfo.landlord_state, landlordInfo.landlord_zip]
      .filter(Boolean)
      .join(', '),
  ].filter(Boolean);
  return parts.join('\n');
}

function buildDocumentText(intake) {
  const template = fs.readFileSync(templatePath, 'utf8');
  const today = new Date().toISOString().slice(0, 10);

  const landlordInfo = intake.landlord_information || {};

  const replacements = {
    '[Date]': today,
    '[Landlord or Property Manager Name]': landlordInfo.landlord_name || '',
    '[Landlord Address]': buildLandlordAddress(landlordInfo),
    '[TENANT NAME]': intake.tenant_information.full_name || '',
    '[PROPERTY ADDRESS]': intake.property_information.property_address || '',
    '[MOVE-OUT DATE]': formatDate(intake.move_out_information.move_out_date),
    '[DEPOSIT AMOUNT]': intake.security_deposit_information.deposit_amount || '',
    '[FORWARDING ADDRESS DATE]': formatDate(
      intake.move_out_information.forwarding_address_date
    ),
  };

  let result = template;
  Object.keys(replacements).forEach((key) => {
    result = result.replace(key, replacements[key]);
  });

  return result;
}

async function generatePdfBuffer(intake) {
  const text = buildDocumentText(intake);
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Informational Summary</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 48px; color: #111; }
      pre { white-space: pre-wrap; line-height: 1.5; font-size: 12pt; }
    </style>
  </head>
  <body>
    <pre>${escapeHtml(text)}</pre>
  </body>
</html>`;

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  const pdfBuffer = await page.pdf({ format: 'Letter', printBackground: true });
  await browser.close();

  return pdfBuffer;
}

module.exports = {
  generatePdfBuffer,
};
