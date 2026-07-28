/**
 * T-Flow Google Apps Script Proxy — v2
 *
 * Deploy this as a web app in Google Apps Script (script.google.com).
 * It proxies read/write operations to a Google Sheet acting as the order database.
 *
 * Version: 2.1.0
 *
 * Required Script Properties (File → Project Settings → Script Properties):
 *   SHEET_ID            — Google Sheet ID (from the URL)
 *   APPS_SCRIPT_SECRET  — Shared secret for request validation
 *
 * Security:
 *   - GET requests require ?secret=<APPS_SCRIPT_SECRET> query param
 *   - POST requests require body._secret or X-TFlow-Secret header (passed as query param)
 *   - All read/write operations are guarded by LockService.getScriptLock()
 *
 * Deploy as: Web app → Execute as Me → Who has access: Anyone
 */

const VERSION = '2.1.0';

function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    var props = PropertiesService.getScriptProperties();
    var secret = props.getProperty('APPS_SCRIPT_SECRET');
    var sheetId = props.getProperty('SHEET_ID');

    if (!sheetId) {
      return jsonResponse(500, { error: 'SHEET_ID not configured in Script Properties' });
    }

    // ---- Secret validation ----
    if (secret) {
      var provided = '';
      if (method === 'GET') {
        provided = e && e.parameter && e.parameter.secret ? e.parameter.secret : '';
      } else if (method === 'POST') {
        // Try body._secret first, fallback to query param
        try {
          var body = JSON.parse(e.postData.contents);
          provided = body._secret || '';
        } catch (_) {
          provided = '';
        }
        if (!provided) {
          provided = e && e.parameter && e.parameter['X-TFlow-Secret']
            ? e.parameter['X-TFlow-Secret']
            : '';
        }
      }

      if (provided !== secret) {
        return jsonResponse(403, { error: 'Forbidden: invalid or missing secret' });
      }
    }

    var sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];

    if (method === 'GET') {
      return handleGet(sheet);
    }

    if (method === 'POST') {
      return handlePost(e, sheet);
    }

    return jsonResponse(405, { error: 'Method not allowed' });
  } catch (err) {
    return jsonResponse(500, {
      error: 'Internal error',
      message: err.message,
      version: VERSION,
    });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function handleGet(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return jsonResponse(200, { orders: [], invalidRows: [], version: VERSION });
  }

  var headers = data[0];
  var orders = [];
  var invalidRows = [];

  for (var i = 1; i < data.length; i++) {
    var row = {};
    row._row = i + 1; // 1-indexed row number
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }

    // Filter out ghost rows: empty phone AND empty product
    var phone = String(row['الهاتف'] || '').trim();
    var product = String(row['المنتج'] || '').trim();
    if (!phone && !product) {
      invalidRows.push({ _row: row._row, date: row['التاريخ'] || '', status: row['الحالة'] || '' });
      continue;
    }

    orders.push(row);
  }

  return jsonResponse(200, { orders: orders, count: orders.length, invalidRows: invalidRows, version: VERSION });
}

function handlePost(e, sheet) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  // Batch update: { batch: [{ _row, updates, _phone, _product }, ...] }
  if (body.batch && Array.isArray(body.batch)) {
    return handleBatchUpdate(body.batch, sheet);
  }

  // Single update: { _row, updates: { col: value, ... }, _phone?, _product? }
  if (typeof body._row === 'number' && body.updates) {
    return handleSingleUpdate(body._row, body.updates, sheet, body._phone, body._product);
  }

  // Single delete: { _delete: true, _row: number }
  if (body._delete === true && typeof body._row === 'number') {
    return handleDelete(body._row, sheet);
  }

  return jsonResponse(400, { error: 'Invalid request format' });
}

function handleSingleUpdate(rowNum, updates, sheet, expectedPhone, expectedProduct) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var range = sheet.getRange(rowNum, 1, 1, headers.length);
  var values = range.getValues()[0];

  // Stale-data check: verify phone & product match expected values
  if (expectedPhone || expectedProduct) {
    var currentPhone = String(values[headers.indexOf('الهاتف')] || '').trim();
    var currentProduct = String(values[headers.indexOf('المنتج')] || '').trim();
    if (expectedPhone && currentPhone !== String(expectedPhone).trim()) {
      return jsonResponse(409, {
        error: 'STALE_DATA',
        message: 'بيانات الطلب تغيرت، يرجى تحديث الصفحة',
        current: { phone: currentPhone, product: currentProduct },
      });
    }
    if (expectedProduct && currentProduct !== String(expectedProduct).trim()) {
      return jsonResponse(409, {
        error: 'STALE_DATA',
        message: 'بيانات الطلب تغيرت، يرجى تحديث الصفحة',
        current: { phone: currentPhone, product: currentProduct },
      });
    }
  }

  var updated = [];
  for (var col in updates) {
    var idx = headers.indexOf(col);
    if (idx !== -1) {
      values[idx] = updates[col];
      updated.push(col);
    }
  }

  range.setValues([values]);

  return jsonResponse(200, {
    success: true,
    row: rowNum,
    updated: updated,
    version: VERSION,
  });
}

function handleBatchUpdate(items, sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var results = [];

  for (var t = 0; t < items.length; t++) {
    var item = items[t];
    if (typeof item._row !== 'number' || !item.updates) continue;

    var range = sheet.getRange(item._row, 1, 1, headers.length);
    var values = range.getValues()[0];

    // Stale-data check
    if (item._phone || item._product) {
      var currentPhone = String(values[headers.indexOf('الهاتف')] || '').trim();
      var currentProduct = String(values[headers.indexOf('المنتج')] || '').trim();
      if (item._phone && currentPhone !== String(item._phone).trim()) {
        results.push({ row: item._row, error: 'STALE_DATA', updated: [] });
        continue;
      }
      if (item._product && currentProduct !== String(item._product).trim()) {
        results.push({ row: item._row, error: 'STALE_DATA', updated: [] });
        continue;
      }
    }

    var updated = [];
    for (var col in item.updates) {
      var idx = headers.indexOf(col);
      if (idx !== -1) {
        values[idx] = item.updates[col];
        updated.push(col);
      }
    }

    range.setValues([values]);
    results.push({ row: item._row, updated: updated });
  }

  return jsonResponse(200, {
    success: true,
    count: results.length,
    results: results,
    version: VERSION,
  });
}

function handleDelete(rowNum, sheet) {
  // Delete the row (shifts all rows below up)
  sheet.deleteRow(rowNum);

  return jsonResponse(200, {
    success: true,
    deletedRow: rowNum,
    version: VERSION,
  });
}

function jsonResponse(status, data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
