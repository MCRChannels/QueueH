
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const excelPath = path.join(__dirname, '../src/assets/db province/thailand.xlsx');

const workbook = XLSX.readFile(excelPath);
console.log('Sheet Names:', workbook.SheetNames);
