import { app } from '@/lib/hono'
import { handle } from 'hono/vercel'

export const GET = handle(app)
export const POST = handle(app)