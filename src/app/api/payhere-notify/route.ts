import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    // PayHere sends notifications as urlencoded form data
    const formData = await request.formData();
    
    const merchantId = (formData.get('merchant_id') as string || '').trim();
    const orderId = (formData.get('order_id') as string || '').trim();
    const paymentId = (formData.get('payment_id') as string || '').trim();
    const payhereAmount = (formData.get('payhere_amount') as string || '').trim();
    const payhereCurrency = (formData.get('payhere_currency') as string || '').trim();
    const statusCode = (formData.get('status_code') as string || '').trim();
    const md5sig = (formData.get('md5sig') as string || '').trim();

    const secret = (process.env.PAYHERE_SECRET || '').trim();

    if (!secret) {
      console.error('PAYHERE_SECRET is not configured on the server');
      return new NextResponse('Internal Server Error', { status: 500 });
    }

    // Verify signature
    // MD5 formula: UpperCase(md5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + UpperCase(md5(merchant_secret))))
    const hashedSecret = crypto.createHash('md5').update(secret).digest('hex').toUpperCase();
    const localString = merchantId + orderId + payhereAmount + payhereCurrency + statusCode + hashedSecret;
    const localSig = crypto.createHash('md5').update(localString).digest('hex').toUpperCase();

    if (localSig !== md5sig) {
      console.error('PayHere Signature Verification Failed. Local signature:', localSig, 'Received:', md5sig);
      return new NextResponse('Invalid signature', { status: 400 });
    }

    // Status code 2 is Success
    if (statusCode === '2') {
      // Update order status in Supabase
      const { error } = await supabase
        .from('orders')
        .update({ paymentStatus: 'paid' })
        .eq('orderNumber', orderId);

      if (error) {
        console.warn('Failed to update order paymentStatus in Supabase (it might be missing in schema):', error.message);
      } else {
        console.log(`Payment successfully verified and updated for order: ${orderId}`);
      }
    } else {
      console.log(`Payment status received for order ${orderId} is ${statusCode} (not success)`);
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error: any) {
    console.error('Error processing PayHere notification:', error);
    return new NextResponse(error?.message || 'Error occurred', { status: 500 });
  }
}
