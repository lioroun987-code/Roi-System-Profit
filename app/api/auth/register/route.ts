import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, password } = schema.parse(body)

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return Response.json({ error: 'משתמש עם כתובת מייל זו כבר קיים' }, { status: 400 })
    }

    const hashed = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { name, email, password: hashed },
    })

    return Response.json({ id: user.id, email: user.email, name: user.name }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'נתונים לא תקינים', details: error.issues }, { status: 400 })
    }
    console.error('Register error:', error)
    return Response.json({ error: 'שגיאת שרת' }, { status: 500 })
  }
}
