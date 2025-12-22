
// CRC16-CCITT implementation for Pix
function crc16(str) {
    let crc = 0xFFFF;
    const strlen = str.length;
    for (let c = 0; c < strlen; c++) {
        crc ^= str.charCodeAt(c) << 8;
        for (let i = 0; i < 8; i++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc = crc << 1;
            }
        }
    }
    let hex = (crc & 0xFFFF).toString(16).toUpperCase();
    if (hex.length < 4) {
        hex = '0'.repeat(4 - hex.length) + hex;
    }
    return hex;
}

function formatField(id, value) {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
}

export function generatePixKey(key, name, city, amount, txId = '***') {
    const payloadKey = formatField('00', 'BR.GOV.BCB.PIX') +
        formatField('01', key || '');

    const merchantAccount = formatField('26', payloadKey);

    const merchantCat = formatField('52', '0000');
    const currency = formatField('53', '986'); // BRL
    const amountStr = amount ? amount.toFixed(2) : '0.00';
    const transactionAmount = formatField('54', amountStr);
    const countryCode = formatField('58', 'BR');
    const merchantName = formatField('59', name || 'NOME DO RECEBEDOR');
    const merchantCity = formatField('60', city || 'CIDADE');

    const addDataField = formatField('05', txId);
    const additionalData = formatField('62', addDataField);

    let payload = formatField('00', '01') + // Payload Format Indicator
        merchantAccount +
        merchantCat +
        currency +
        transactionAmount +
        countryCode +
        merchantName +
        merchantCity +
        additionalData +
        '6304'; // CRC16 ID

    const crc = crc16(payload);
    return payload + crc;
}
