'use server'
import crypto from 'crypto';

export async function generatePayHereHash(orderId: string, amount: number) {
    const merchantId = (process.env.NEXT_PUBLIC_PAYHERE_MERCHANT_ID || '').trim();
    const secret = (process.env.PAYHERE_SECRET || '').trim();
    const currency = 'LKR';

    // Clean orderId (remove any unexpected leading hash tags or spaces)
    const cleanOrderId = orderId.trim();

    // Amount => decimals (PayHere expects exactly "100.00" format)
    const formattedAmount = Number(amount).toFixed(2);

    // MD5 Hash formula: UpperCase(md5(merchant_id + order_id + formatted_amount + currency + UpperCase(md5(merchant_secret))))
    const hashedSecret = crypto.createHash('md5').update(secret).digest('hex').toUpperCase();
    const mainString = merchantId + cleanOrderId + formattedAmount + currency + hashedSecret;
    const hash = crypto.createHash('md5').update(mainString).digest('hex').toUpperCase();

    return hash;
}
