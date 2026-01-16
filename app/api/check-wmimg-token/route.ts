import { NextResponse } from 'next/server'
import { getWmimgToken } from '@/app/actions/image-upload'

export async function GET() {
  try {
    const token = await getWmimgToken()
    const envToken = process.env.WMIMG_TOKEN
    const hasToken = !!(token || envToken)

    return NextResponse.json({ hasToken })
  } catch (error) {
    return NextResponse.json({ hasToken: false })
  }
}






