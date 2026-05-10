import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    <div
      style={{
        fontSize: 340,
        background: '#2D5A27',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        borderRadius: 100,
        fontWeight: 700,
      }}
    >
      P
    </div>,
    { width: 512, height: 512 }
  );
}
