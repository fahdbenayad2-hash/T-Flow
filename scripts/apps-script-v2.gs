/**
 * T-Flow Google Apps Script Proxy — v2
 *
 * Deploy this as a web app in Google Apps Script (script.google.com).
 * It proxies read/write operations to a Google Sheet acting as the order database.
 *
 * Version: 2.0.0
 *
 * Required Script Properties (File → Project Settings → Script Properties):
 *   SHEET_ID        — Google Sheet ID (from the URL)
 *   APPS_SCRIPT_SECRET — Shared secret for X-TFlow-Secret header validation
 *
 * Deploy as: Web app → Execute as Me → Who has access: Anyone
 */

const VERSION = '2.0.0';

function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  try {
    const props = PropertiesService.getScriptProperties();
    const secret = props.getProperty('APPS_SCRIPT_SECRET');
    const sheetId = props.getProperty('SHEET_ID');

    if (!sheetId) {
      return jsonResponse(500, { error: 'SHEET_ID not configured in Script Properties' });
    }

    // Secret validation (skip if no secret configured)
    if (secret) {
      const provided = e.parameter && e.parameter['X-TFlow-Secret']
        ? e.parameter['X-TFlow-Secret']
        : '';

      // For POST requests, check the header via ContentService
      // Note: GAS web apps don't expose custom headers directly in doGet/doPost.
      // We use a query param fallback for secret passing.
      // In production, validate via a token in the request body or URL.
    }

    const sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];

    if (method === 'GET') {
      return handleGet(sheet);
    }

    if (method === 'POST') {
      return handlePost(e, sheet, secret);
    }

    return jsonResponse(405, { error: 'Method not allowed' });
  } catch (err) {
    return jsonResponse(500, {
      error: 'Internal error',
      message: err.message,
      version: VERSION,
    });
  }
}

function handleGet(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return jsonResponse(200, { orders: [], version: VERSION });
  }

  const headers = data[0];
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    const row = {};
    row._row = i + 1; // 1-indexed row number
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    rows.push(row);
  }

  return jsonResponse(200, { orders: rows, count: rows.length, version: VERSION });
}

function handlePost(e, sheet, secret) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  // Validate secret from body
  if (secret && body._secret !== secret) {
    // Also check the header workaround (passed as query param for GAS limitations)
    const paramSecret = e.parameter && e.parameter['X-TFlow-Secret'];
    if (paramSecret !== secret) {
      return jsonResponse(403, { error: 'Invalid or missing secret' });
    }
  }

  // Batch update: { batch: [{ _row, updates }, ...] }
  if (body.batch && Array.isArray(body.batch)) {
    return handleBatchUpdate(body.batch, sheet);
  }

  // Single update: { _row, updates: { col: value, ... } }
  if (typeof body._row === 'number' && body.updates) {
    return handleSingleUpdate(body._row, body.updates, sheet);
  }

  return jsonResponse(400, { error: 'Invalid request format' });
}

function handleSingleUpdate(rowNum, updates, sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const range = sheet.getRange(rowNum, 1, 1, headers.length);
  const values = range.getValues()[0];

  const updated = [];
  for (const col in updates) {
    const idx = headers.indexOf(col);
    if (idx !== -1) {
      values[idx] = updates[col];
      updated.push(col);
    }
  }

  range.setValues([values]);

  return jsonResponse(200, {
    success: true,
    row: rowNum,
    updated,
    version: VERSION,
  });
}

function handleBatchUpdate(items, sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const results = [];

  for (const item of items) {
    if (typeof item._row !== 'number' || !item.updates) continue;

    const range = sheet.getRange(item._row, 1, 1, headers.length);
    const values = range.getValues()[0];

    const updated = [];
    for (const col in item.updates) {
      const idx = headers.indexOf(col);
      if (idx !== -1) {
        values[idx] = item.updates[col];
        updated.push(col);
      }
    }

    range.setValues([values]);
    results.push({ row: item._row, updated });
  }

  return jsonResponse(200, {
    success: true,
    count: results.length,
    results,
    version: VERSION,
  });
}

function jsonResponse(status, data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
