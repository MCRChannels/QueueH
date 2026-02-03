
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const excelPath = path.join(__dirname, '../src/assets/db province/thailand.xlsx');
const jsonPath = path.join(__dirname, '../src/data/thai_addresses.json');

if (!fs.existsSync(path.dirname(jsonPath))) {
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
}

console.log('Reading Excel...');
const workbook = XLSX.readFile(excelPath);

// Target specific sheet
const sheetName = 'TambonDatabase';
console.log(`Processing sheet: ${sheetName}`);
const sheet = workbook.Sheets[sheetName];

const rawData = XLSX.utils.sheet_to_json(sheet);

if (rawData.length > 0) {
    console.log('First row keys:', Object.keys(rawData[0]));

    // Map based on the keys seen in the screenshot or standard conventions
    // Screenshot showed keys like: TambonID, TambonThai, DistrictThai, ProvinceThai, PostCodeMain

    const processedData = rawData.map(row => ({
        province: row['ProvinceThai'] || '', // Thai Name
        district: row['DistrictThai'] || '', // Amphoe Thai Name
        subDistrict: row['TambonThai'] || '', // Tambon Thai Name
        zipcode: row['PostCodeMain'] || '' // Zipcode
    })).filter(item => item.province && item.district && item.subDistrict);

    console.log(`Processed ${processedData.length} records.`);

    fs.writeFileSync(jsonPath, JSON.stringify(processedData, null, 2));
    console.log('Success!');
} else {
    console.log('Sheet is empty');
}
