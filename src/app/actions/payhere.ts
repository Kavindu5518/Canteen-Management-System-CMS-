'use server'
import crypto from 'crypto';

export async function generatePayHereHash(orderId: string, amount: number) {
    const merchantId = process.env.NEXT_PUBLIC_PAYHERE_MERCHANT_ID!;
    const secret = process.env.PAYHERE_SECRET!;
    const currency = 'LKR';

    // Amount => decimals (PayHere expects exactly "105.00" format — toFixed is safest)
    const formattedAmount = amount.toFixed(2);

    // MD5 Hash formula: UpperCase(md5(merchant_id + order_id + formatted_amount + currency + UpperCase(md5(merchant_secret))))
    const hashedSecret = crypto.createHash('md5').update(secret).digest('hex').toUpperCase();
    const mainString = merchantId + orderId + formattedAmount + currency + hashedSecret;
    const hash = crypto.createHash('md5').update(mainString).digest('hex').toUpperCase();

    return hash;
}
