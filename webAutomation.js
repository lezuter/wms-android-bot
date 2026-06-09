const puppeteer = require('puppeteer');
require('dotenv').config();

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function inputCustomerWMS(dataList) {
    if (dataList.length === 0) return;

    console.log(`\n🌐 Memulai Web Automation untuk ${dataList.length} Customer...`);
    
    const browser = await puppeteer.launch({ 
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    }); 
    const page = await browser.newPage();

    try {
        // --- 1. PROSES LOGIN ---
        console.log(`[WMS] Membuka halaman login...`);
        await page.goto('https://wms.step-point.net/index.php/auth/login', { waitUntil: 'networkidle2' }); 
        
        await page.type('#username', process.env.WMS_USER);
        await page.type('#password', process.env.WMS_PASS);
        
        console.log(`[WMS] Mengirim data login...`);
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            page.click('button[type="submit"]')
        ]);
        console.log(`[WMS] Login berhasil!`);

        // --- 1.5 KLIK MENU CUSTOMERS DI SIDEBAR (MASUK HALAMAN TABEL) ---
        console.log(`[WMS] Membuka menu Customers...`);
        await page.waitForSelector('.sidebar a[href$="/admin/customers"]');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            page.click('.sidebar a[href$="/admin/customers"]')
        ]);

        // --- 2. PROSES INPUT CUSTOMER (LOOPING) ---
        for (let i = 0; i < dataList.length; i++) {
            const cust = dataList[i];
            console.log(`\n[WMS ${i+1}/${dataList.length}] Memproses: ${cust.nama} (${cust.kode})`);
            
            // KLIK TOMBOL "TAMBAH PELANGGAN" DI HALAMAN TABEL UTAMA
            console.log(`[WMS] Mengklik tombol 'Tambah Pelanggan'...`);
            await page.waitForSelector('a[href$="/admin/customers/create"]');
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle2' }),
                page.click('a[href$="/admin/customers/create"]')
            ]);

            // 1. Ketik Kode Pelanggan
            await page.type('input[name="customer_code"]', cust.kode);
            
            // 2. Tekan TAB untuk triger pengecekan AJAX
            await page.keyboard.press('Tab');
            await delay(1200); // Kasih jeda santai biar sistem kelar ngecek ke DB
            
            // 3. Cek Duplikat via ID Elemen merah/hijau dari lu
            const isDuplicate = await page.evaluate(() => {
                const err = document.querySelector('#code-error');
                return err && err.offsetParent !== null && err.innerText.includes('sudah ada');
            });

            if (isDuplicate) {
                console.log(`[WMS] ⚠️ SKIP: Kode ${cust.kode} sudah ada. Balik ke tabel...`);
                await page.goto('https://wms.step-point.net/index.php/admin/customers', { waitUntil: 'networkidle2' });
                continue; 
            }

            console.log(`[WMS] Kode tersedia, melanjutkan pengisian data...`);
            
            // ISI NAMA DAN ALAMAT
            await page.type('input[name="name"]', cust.nama);
            await delay(200);
            await page.type('textarea[name="address"]', cust.alamat);
            await delay(200);
            
            // ISI INFO KONTAK (KUNCI MATI PAKE ELEMEN ASLI LU, CUY!)
            await page.type('input[name="contact_info"]', cust.kontak);
            await delay(300);
            
            // KLIK TOMBOL SIMPAN (Otomatis redirect balik ke halaman tabel setelah ini)
            console.log(`[WMS] Menyimpan data pelanggan...`);
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle2' }),
                page.click('button[type="submit"].btn-primary') 
            ]);

            console.log(`✅ Sukses disimpan! Kembali ke halaman tabel.`);
            await delay(1200); // Jeda aman sebelum klik "Tambah Pelanggan" lagi
        }

        console.log("\n🎉 SELURUH PROSES WEB AUTOMATION SELESAI!");
        
    } catch (error) {
        console.error("❌ Terjadi kesalahan di Web Automation WMS:", error.message);
    } finally {
        await delay(5000); 
        await browser.close();
    }
}

module.exports = { inputCustomerWMS };