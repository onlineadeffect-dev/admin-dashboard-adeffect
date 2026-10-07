import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '/Users/mel_samad/Desktop/miry_projects/Ad Effect/Ad Effect/admin-dashboard/.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data: pb } = await supabase.from('pending_bookings').select('*').limit(1)
  const { data: pbi } = await supabase.from('pending_booking_items').select('*').limit(1)
  const { data: b } = await supabase.from('bookings').select('*').limit(1)
  const { data: bi } = await supabase.from('booking_items').select('*').limit(1)
  
  console.log("pending_bookings:", pb)
  console.log("pending_booking_items:", pbi)
  console.log("bookings:", b)
  console.log("booking_items:", bi)
}
test()
