function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Apps Script running' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  // 如果 GAS 收到的是 application/x-www-form-urlencoded，e.parameter 會有值。
  // 透過 /api/log 轉發時，我們會使用這種格式。
  const params = Object.keys(e.parameter).length ? e.parameter : parseJsonPostData(e);

  const sheetId = 'YOUR_SPREADSHEET_ID_HERE';
  const sheetName = '工作表1';
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: `Sheet ${sheetName} not found` }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const id = params.id || Utilities.getUuid();
  const timestamp = params.timestamp || new Date().toISOString();
  const userName = params.userName || '';
  const scenario = params.scenario || '';
  const studentInput = params.studentInput || '';
  const aiFeedback = params.aiFeedback || '';

  sheet.appendRow([id, timestamp, userName, scenario, studentInput, aiFeedback]);

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', id: id }))
    .setMimeType(ContentService.MimeType.JSON);
}

function parseJsonPostData(e) {
  if (e.postData && e.postData.type === 'application/json' && e.postData.contents) {
    try {
      return JSON.parse(e.postData.contents);
    } catch (err) {
      return {};
    }
  }
  return {};
}
