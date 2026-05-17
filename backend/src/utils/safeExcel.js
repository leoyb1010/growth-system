const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const dangerousKeys = new Set(['__proto__', 'prototype', 'constructor']);

function normalizeCellValue(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value;
  if (typeof value !== 'object') return value;

  if (Object.prototype.hasOwnProperty.call(value, 'result')) {
    return normalizeCellValue(value.result);
  }
  if (value.richText) {
    return value.richText.map(part => part.text || '').join('');
  }
  if (value.text) return value.text;
  if (value.hyperlink) return value.text || value.hyperlink;

  return String(value);
}

function rowToArray(row, columnCount) {
  const values = [];
  for (let col = 1; col <= columnCount; col++) {
    values.push(normalizeCellValue(row.getCell(col).value));
  }
  return values;
}

async function readWorkbook(filePath) {
  let ext = path.extname(filePath).toLowerCase();
  if (!ext) {
    const header = fs.readFileSync(filePath, { encoding: null, flag: 'r' }).subarray(0, 2).toString('utf8');
    ext = header === 'PK' ? '.xlsx' : '.csv';
  }
  const workbook = new ExcelJS.Workbook();

  if (ext === '.csv') {
    const worksheet = await workbook.csv.readFile(filePath);
    return {
      SheetNames: [worksheet.name],
      Sheets: { [worksheet.name]: worksheet }
    };
  }

  await workbook.xlsx.readFile(filePath, {
    ignoreNodes: ['dataValidations', 'extLst']
  });

  const sheets = {};
  workbook.worksheets.forEach(worksheet => {
    sheets[worksheet.name] = worksheet;
  });

  return {
    SheetNames: workbook.worksheets.map(worksheet => worksheet.name),
    Sheets: sheets
  };
}

function sheetToJson(worksheet, options = {}) {
  const columnCount = worksheet.columnCount || 0;

  if (options.header === 1) {
    const rows = [];
    worksheet.eachRow({ includeEmpty: false }, row => {
      rows.push(rowToArray(row, columnCount));
    });
    return rows;
  }

  const headerRow = worksheet.getRow(1);
  const headers = rowToArray(headerRow, columnCount).map(header => String(header || '').trim());
  const rows = [];

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const record = Object.create(null);
    let hasValue = false;

    for (let col = 1; col <= columnCount; col++) {
      const header = headers[col - 1];
      if (!header || dangerousKeys.has(header)) continue;

      let value = normalizeCellValue(row.getCell(col).value);
      if ((value === null || value === undefined) && Object.prototype.hasOwnProperty.call(options, 'defval')) {
        value = options.defval;
      }
      if (value !== null && value !== undefined && value !== '') hasValue = true;
      record[header] = value;
    }

    if (hasValue || options.blankrows) {
      Object.defineProperty(record, '__rowNum__', { value: rowNumber, enumerable: false });
      rows.push(record);
    }
  }

  return rows;
}

function book_new() {
  return { __sheets: [] };
}

function aoa_to_sheet(rows) {
  return { __rows: rows };
}

function json_to_sheet(data) {
  const headers = [];
  data.forEach(row => {
    Object.keys(row || {}).forEach(key => {
      if (!headers.includes(key)) headers.push(key);
    });
  });
  return { __rows: [headers, ...data.map(row => headers.map(header => row?.[header]))] };
}

function sanitizeCellForWrite(value) {
  if (typeof value !== 'string') return value;
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function book_append_sheet(workbook, sheet, name) {
  workbook.__sheets.push({ name, rows: sheet.__rows || [] });
}

function toExcelWorkbook(workbook) {
  const excelWorkbook = new ExcelJS.Workbook();
  (workbook.__sheets || []).forEach(sheet => {
    const worksheet = excelWorkbook.addWorksheet(sheet.name || 'Sheet1');
    (sheet.rows || []).forEach(row => worksheet.addRow((row || []).map(sanitizeCellForWrite)));
  });
  return excelWorkbook;
}

async function write(workbook) {
  const buffer = await toExcelWorkbook(workbook).xlsx.writeBuffer();
  return Buffer.from(buffer);
}

async function writeFile(workbook, filePath) {
  await toExcelWorkbook(workbook).xlsx.writeFile(filePath);
}

module.exports = {
  readWorkbook,
  sheetToJson,
  sanitizeCellForWrite,
  xlsx: {
    utils: {
      book_new,
      aoa_to_sheet,
      json_to_sheet,
      book_append_sheet
    },
    write,
    writeFile
  }
};
