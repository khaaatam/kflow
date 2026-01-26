const formatRupiah = (angka) => {
    const val = Number(angka) || 0;
    return new Intl.NumberFormat('id-ID', { 
        style: 'currency', 
        currency: 'IDR', 
        minimumFractionDigits: 0 
    }).format(val);
};

module.exports = { formatRupiah };