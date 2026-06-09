// index.js
const readline = require('readline');
const { getDaftarTeknisi, getSnByDoneStatus, getSnByTeknisi } = require('./sheets');
const { prosesSatuSN, setBotStatus, getBotStatus, runAdb, prosesPairingAplikasi } = require('./automation');
const { inputCustomerWMS } = require('./webAutomation');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const tungguEnter = (pertanyaan) => {
    return new Promise(resolve => rl.question(pertanyaan, resolve));
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    console.log("===================================");
    console.log("🤖 BOT AUTO-INPUT ONT - FULL VERSION");
    console.log("===================================");
    console.log("1. Mode Google Sheets (Pilih Teknisi)");
    console.log("2. Mode Paste Manual (Auto-Lookup Sheets) 🔥");
    console.log("3. Mode Status 'Done' (Otomatis)");
    console.log("===================================");

    const mode = await tungguEnter('Pilih Mode (1/2/3): ');

    let listSn = [];
    let sumberData = "";
    let masterSheetsData = []; 

    if (mode === '2' || mode === '3') {
        console.log("🔄 Menghubungkan ke Google Sheets untuk sinkronisasi data master... \n");
        try {
            masterSheetsData = await getSnByDoneStatus();
        } catch (e) {
            console.error("❌ Gagal mengambil data gsheet:", e.message);
        }
    }

    if (mode === '3') {
        listSn = masterSheetsData;
        sumberData = "Status Done (Otomatis)";
    } else if (mode === '1') {
        try {
            const listTeknisi = await getDaftarTeknisi();
            if (listTeknisi.length === 0) {
                console.log("❌ Gagal dapet data teknisi.");
                process.exit(0);
            }
            listTeknisi.forEach((nama, index) => console.log(`${index + 1}. ${nama}`));
            const answer = await tungguEnter('\nMasukkan nomor teknisi: ');
            const selectedIndex = parseInt(answer) - 1;

            if (selectedIndex >= 0 && selectedIndex < listTeknisi.length) {
                const namaTarget = listTeknisi[selectedIndex];
                sumberData = `Sheets (${namaTarget})`;
                listSn = await getSnByTeknisi(namaTarget);
            } else {
                console.log('❌ Nomor tidak valid.');
                process.exit(0);
            }
        } catch (e) {
            console.error("❌ Error Sheets:", e.message);
            process.exit(0);
        }
    } else if (mode === '2') {
        console.log("\n[!] SILAKAN PASTE TEKS DI SINI (CTRL+V)");
        console.log("[!] Tekan ENTER dua kali berturut-turut untuk MULAI.");

        const inputTeks = await new Promise(resolve => {
            let buffer = "";
            rl.on('line', (line) => {
                if (line.trim() === "") resolve(buffer);
                buffer += line + "\n";
            });
        });

        const matches = inputTeks.match(/M\d{9}/g);
        if (!matches) {
            console.log("❌ Gak nemu SN format M + 9 digit.");
            process.exit(0);
        }
        
        const snUnik = [...new Set(matches)];
        sumberData = "Paste Manual + Auto-Lookup Sheets";

        console.log("🔍 Menyinkronkan teks SN dengan data nama/alamat di Sheets...");
        listSn = snUnik.map(sn => {
            const dataKetemu = masterSheetsData.find(item => item.sn.toLowerCase() === sn.toLowerCase());
            if (dataKetemu) {
                return dataKetemu; 
            } else {
                return { sn: sn, kode: "", nama: `Customer Manual (${sn})`, alamat: "", kontak: "" };
            }
        });
    }

    if (listSn.length === 0) {
        console.log(`[-] Antrean kosong murni.`);
        rl.close();
        process.exit(0);
    }

    console.log(`\n✅ BERHASIL MENGAMBIL ${listSn.length} SN UNIK DARI ${sumberData}.`);

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) process.stdin.setRawMode(true);

    console.log("===================================");
    console.log("🎮 KONTROL BOT (HOTKEYS):");
    console.log("👉 [SPASI] : START / PAUSE");
    console.log("👉 [Q]     : STOP & KELUAR");
    console.log("===================================\n");

    let currentIndex = 0;
    let isProcessing = false;
    let isPaused = true;
    let hasilLog = [];
    let listSuksesWMS = []; 

    console.log(`Siapkan aplikasi di LDPlayer, lalu tekan SPASI buat GASPOL!`);

    async function jalankanAntrean() {
        isProcessing = true;

        while (currentIndex < listSn.length && !isPaused && getBotStatus()) {
            const data = listSn[currentIndex];

            console.log(`\n[${currentIndex + 1}/${listSn.length}] Memproses: ${data.sn}`);

            const result = await prosesSatuSN(data.sn);
            hasilLog.push({ sn: data.sn, status: result.pesan });

            if (result.sukses) {
                if (data.kode !== "") {
                    listSuksesWMS.push(data);
                } else {
                    console.log(`⚠️ Data Pelanggan untuk SN ${data.sn} tidak ditemukan di GSheets, dilewati untuk WMS.`);
                }
            }

            currentIndex++;
            await delay(2000);
        }

        isProcessing = false;

        if (currentIndex >= listSn.length) {
            if (process.stdin.isTTY) process.stdin.setRawMode(false);
            
            console.log("\n===================================");
            console.log("🏁 REKAP INPUT SELESAI");
            console.log("===================================");
            hasilLog.forEach((item, idx) => {
                const icon = item.status.includes("KETEMU") ? "✅" : "❌";
                console.log(`${idx + 1}. ${item.sn} -> ${icon} ${item.status}`);
            });
            console.log("===================================\n");

            if (listSuksesWMS.length > 0) {
                console.log(`🎉 Ada ${listSuksesWMS.length} data customer hasil sinkronisasi.`);
                console.log(`🌐 [WMS] Mengotomatisasi pembukaan Chrome dan pengisian Web WMS sekarang, tunggu sebentar...`);
                
                // 1. Eksekusi input data customer ke Web WMS Chrome sampai selesai murni
                await inputCustomerWMS(listSuksesWMS);
                
                console.log("\n=======================================================");
                console.log("🚀 CHROME WMS SELESAI! MENGEKSEKUSI ALUR OTOMATIS EMULATOR...");
                console.log("=======================================================");
                
                // --- PROSES BACK LENGKAP NYATA (DENGAN RECONNECT BIAR COK) ---
                console.log("[ADB] Menghubungkan ulang ke device...");
                await runAdb("connect 127.0.0.1:5555");
                await delay(500);

                console.log("[ADB] Menekan tombol 'Kembali' pertama...");
                await runAdb("shell input keyevent 4"); 
                await delay(1200);
                
                console.log("[ADB] Menekan tombol 'Kembali' kedua (Mereset total ke menu utama)...");
                await runAdb("shell input keyevent 4"); 
                await delay(2000); 

                // 2. Ambil XML baru untuk nyari tombol menu utama secara akurat
                let xmlMenu = null;
                try {
                    await runAdb('shell rm /data/local/tmp/uidump.xml');
                    const dumpStatus = await runAdb('shell uiautomator dump /data/local/tmp/uidump.xml');
                    if (dumpStatus && dumpStatus.includes('UI hierchary dumped to')) {
                        await delay(500);
                        xmlMenu = await runAdb('shell cat /data/local/tmp/uidump.xml');
                    }
                } catch(err) {
                    xmlMenu = null;
                }
                
                let posMenu = null;
                if (xmlMenu) {
                    const regex = new RegExp(`text="[^"]*Terpasang di Pelanggan[^"]*".*?bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`, 'i');
                    const match = regex.exec(xmlMenu);
                    if (match) {
                        posMenu = {
                            x: Math.floor((parseInt(match[1]) + parseInt(match[3])) / 2),
                            y: Math.floor((parseInt(match[2]) + parseInt(match[4])) / 2)
                        };
                    }
                }

                // 3. Eksekusi Klik Menu Utama
                if (posMenu) {
                    console.log("[ADB] Menu 'Terpasang di Pelanggan' ketemu! Mengklik otomatis...");
                    await runAdb(`shell input tap ${posMenu.x} ${posMenu.y}`);
                    await delay(2000); 
                } else {
                    console.log("\n⚠️  BOT REM TANGAN: Gagal mendeteksi teks menu 'Terpasang di Pelanggan'.");
                    console.log("👉 Silakan buka aplikasinya dan MASUKKAN SAMPAI KE MENU 'TERPASANG DI PELANGGAN' secara manual.");
                    
                    // KOREKSI UTAMA: Tanda petik ganda luar membungkus petik tunggal dalem biar valid 100%!
                    const siapManual = await tungguEnter("\n⏩ Layar emulator udah bersih di posisi menu 'Terpasang di Pelanggan'? Ketik (y) lalu ENTER: ");
                    if (!siapManual.toLowerCase().trim().startsWith('y')) {
                        console.log("ℹ️ Proses pairing dibatalkan oleh pengguna.");
                        rl.close();
                        process.exit(0);
                    }
                }

                // 4. JALANKAN LOGIKA PAIRING ONT SECARA OTOMATIS
                console.log("\n🎮 Memulai proses input kelanjutan aplikasi (Pairing SN otomatis)...");
                await prosesPairingAplikasi(listSuksesWMS);

            } else {
                console.log("ℹ️ Tidak ada data hasil sinkronisasi Sheets yang memenuhi syarat untuk diinput ke WMS.");
            }

            console.log("\n👋 Seluruh rangkaian proses otomatis selesai total hari ini. Menutup koneksi bot. Sampai jumpa!");
            rl.close(); 
            process.exit(0); 
        }
    }

    process.stdin.on('keypress', (str, key) => {
        if (process.stdin.isTTY && process.stdin.setRawMode) {
            if (key.name === 'q') {
                rl.close();
                process.exit();
            }
            if (key.name === 'space') {
                if (!isPaused) {
                    console.log('\n⏸️ BOT PAUSE...');
                    isPaused = true;
                    setBotStatus(false);
                } else {
                    console.log('\n▶️ BOT RUNNING...');
                    isPaused = false;
                    setBotStatus(true);
                    if (!isProcessing) jalankanAntrean();
                }
            }
        }
    });
}

main();