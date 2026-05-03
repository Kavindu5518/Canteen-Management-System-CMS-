import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl!, supabaseAnonKey!)

async function testOrderFlow() {
  console.log("--- Starting Purchase Function Test ---")
  
  try {
    // 1. Check connectivity
    const { data: menu, error: menuErr } = await supabase.from('menu_items').select('*').limit(1)
    if (menuErr) throw new Error("Menu fetch failed: " + menuErr.message)
    console.log("✅ Database connectivity: OK")

    // 2. Mock order data
    const testOrder = {
      orderNumber: "#TEST" + Math.floor(Math.random() * 1000),
      userName: "Test Customer",
      status: "pending",
      deliveryType: "self_pickup",
      paymentMethod: "card",
      subtotal: 100,
      deliveryFee: 0,
      tax: 5,
      total: 105
    }

    // 3. Try to insert order
    const { data: order, error: orderErr } = await supabase.from('orders').insert([testOrder]).select().single()
    if (orderErr) throw new Error("Order insertion failed: " + orderErr.message)
    console.log("✅ Order insertion: OK (ID: " + order.id + ")")

    // 4. Try to insert order item
    const testItem = {
      orderId: order.id,
      name: "Test Item",
      price: 100,
      quantity: 1
    }
    const { error: itemErr } = await supabase.from('order_items').insert([testItem])
    if (itemErr) throw new Error("Order item insertion failed: " + itemErr.message)
    console.log("✅ Order item insertion: OK")

    // 5. Cleanup
    await supabase.from('orders').delete().eq('id', order.id)
    console.log("✅ Test cleanup: OK")
    
    console.log("--- Test Completed: ALL SYSTEMS GO ---")
  } catch (err: any) {
    console.error("❌ TEST FAILED:", err.message)
  }
}

testOrderFlow()
