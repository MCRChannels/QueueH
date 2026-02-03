
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const excelPath = path.join(__dirname, '../src/assets/db province/thailand.xlsx');

const workbook = XLSX.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

// Read as array of arrays to inspect structure
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, defval: '' });

console.log('Top 5 rows:');
data.slice(0, 5).forEach((row, i) => {
    console.log(`Row ${i}:`, JSON.stringify(row));
});
