// sheets.js
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const config = require('./config');
const creds = require('./service-account.json'); 

async function getDoc() {
    const auth = new JWT({
        email: creds.client_email, 
        key: creds.private_key,    
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const doc = new GoogleSpreadsheet(config.sheetId, auth);
    await doc.loadInfo();
    return doc;
}

// OPSI 1: Nembak ke DATA MASTER
async function getDaftarTeknisi() {
    const doc = await getDoc();
    const sheet = doc.sheetsByTitle['DATA MASTER Project Migrasi MNC'] || doc.sheetsByIndex[0];
    await sheet.loadHeaderRow(1); 
    const rows = await sheet.getRows();
    const names = new Set();
    rows.forEach(row => {
        const team = row.get('Nama Team'); 
        if (team) team.split(/\s+/).forEach(n => names.add(n.trim()));
    });
    return Array.from(names);
}

// OPSI 3: Nembak HANYA ke LIST BAST (Header Baris 17)
async function getSnByDoneStatus() {
    const doc = await getDoc();
    let gabunganData = [];

    // UBAH DI SINI: Hapus Data Master & CSWO, sisain LIST BAST doang
    const targetTabs = [
        { nama: 'LIST BAST', header: 17 }
    ];

    for (const target of targetTabs) {
        try {
            const sheet = doc.sheetsByTitle[target.nama];
            if (!sheet) continue;

            console.log(`[Sheets] Membaca data dari Tab: "${sheet.title}" (Header Baris ${target.header})...`);
            await sheet.loadHeaderRow(target.header); 
            const rows = await sheet.getRows();

            if (rows.length === 0) continue;

            rows.forEach(row => {
                const snValue = (row.get('SN STB') || "").toString().trim();
                if (snValue) {
                    gabunganData.push({
                        sn: snValue,
                        kode: (row.get('CID') || "").toString().trim(), 
                        nama: (row.get('End Customer Name') || "").toString().trim(),                      
                        alamat: (row.get('Alamat Customer') || "").toString().trim(),                  
                        kontak: (row.get('Telephone') || "").toString().trim()                             
                    });
                }
            });
        } catch (e) {
            console.log(`⚠️ Gagal memproses Tab "${target.nama}":`, e.message);
        }
    }

    return gabunganData; 
}

// OPSI 1: Nembak ke DATA MASTER
async function getSnByTeknisi(namaTarget) {
    const doc = await getDoc();
    const sheet = doc.sheetsByTitle['DATA MASTER Project Migrasi MNC'] || doc.sheetsByIndex[0];
    await sheet.loadHeaderRow(1);
    const rows = await sheet.getRows();

    return rows
        .filter(row => {
            const team = (row.get('Nama Team') || "").toString().toLowerCase();
            return team.includes(namaTarget.toLowerCase());
        })
        .map(row => ({
            sn: (row.get('SN STB') || "").toString().trim(),
            kode: (row.get('CID') || "").toString().trim(),
            nama: (row.get('End Customer Name') || "").toString().trim(),
            alamat: (row.get('Alamat Customer') || "").toString().trim(),
            kontak: (row.get('Telephone') || "").toString().trim()
        })).filter(item => item.sn !== '');
}

module.exports = { getSnByDoneStatus, getDaftarTeknisi, getSnByTeknisi };