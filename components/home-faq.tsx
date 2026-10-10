const questions = [
  {
    question: 'Kenapa harga Luminails di Shopee dan di aplikasi bisa berbeda?',
    answer: 'Produknya sama. Marketplace umum seperti Shopee memiliki fee marketplace dan biaya promosi yang berbeda. Di aplikasi Luminails, biaya utamanya adalah payment gateway, sehingga kami dapat memberikan produk premium dengan harga khusus customer salon yang lebih bersahabat.',
  },
  {
    question: 'Kenapa harus memilih paket dulu?',
    answer: 'Paket menjaga jumlah, harga volume, stok, tambahan, dan benefit tetap jelas. Setelah paket dipilih, produk yang tersedia di dalamnya dapat disesuaikan sebelum checkout.',
  },
  {
    question: 'Bagaimana cara belanja di Luminails?',
    answer: 'Buat akun, lengkapi profil salon atau studio, pilih paket, lalu checkout. Kamu dapat melihat detail produk untuk membantu memilih isi paket, tetapi checkout produk satuan tidak tersedia. Harga yang tampil mengikuti tier akunmu.',
  },
  {
    question: 'Kalau order sebelum jam 2 siang, kapan diproses?',
    answer: 'Order yang lengkap dan terkonfirmasi sebelum pukul 14.00 akan kami usahakan diproses pada hari yang sama. Waktu pickup tetap mengikuti jadwal kurir dan ketersediaan stok.',
  },
  {
    question: 'Bagaimana saya menerima nomor resi dan update order?',
    answer: 'Setelah order diproses, tim akan mengirim update status dan nomor resi melalui WhatsApp. Status order dan pelacakan juga tersimpan di menu Riwayat order agar mudah dicek kembali.',
  },
  {
    question: 'Apa itu LumiPoints dan bagaimana rebate-nya bekerja?',
    answer: 'LumiPoints diberikan dari pembelanjaan yang memenuhi aturan program. Besaran poin, rebate, dan reward mengikuti tier akunmu. Poin dapat digunakan sesuai katalog reward yang tersedia, bukan sebagai uang tunai.',
  },
  {
    question: 'Bagaimana saya tahu jarak menuju tier berikutnya?',
    answer: 'Menu akun akan menampilkan tier saat ini, total belanja terbayar, jumlah order selesai, dan progres menuju tier berikutnya. Jadi kamu dapat melihat syarat yang masih kurang sebelum mendapatkan benefit berikutnya.',
  },

];

export function HomeFaq() {
  return <section className="home-faq section-pad" id="faq"><div className="home-faq-intro"><p className="eyebrow">Belanja dengan jelas</p><h2>Belanja untuk bisnis<br /><em>tanpa tanda tanya.</em></h2><p>Hal penting yang perlu diketahui sebelum memilih paket dan mulai order bersama Luminails.</p><a href="/packages" className="underlined-link">Lihat semua paket <span>-&gt;</span></a></div><div className="home-faq-list">{questions.map((item, index) => <details key={item.question} open={index === 0}><summary><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.question}</strong><b>+</b></summary><p>{item.answer}</p></details>)}</div></section>;
}
