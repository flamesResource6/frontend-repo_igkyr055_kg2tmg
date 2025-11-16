import React from 'react'
import Spline from '@splinetool/react-spline'
import Game from './components/Game'

export default function App() {
  return (
    <div className="min-h-screen w-full bg-gray-900 text-white">
      <header className="relative h-[55vh] w-full overflow-hidden">
        <Spline
          scene="https://prod.spline.design/Jd4wcqFfe70N-TXP/scene.splinecode"
          style={{ width: '100%', height: '100%' }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-black/40 to-gray-900/95" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <h1 className="text-4xl md:text-6xl font-extrabold drop-shadow-lg">Pocket Grove</h1>
          <p className="mt-3 max-w-2xl text-white/90 md:text-lg">
            Mini-game 2D bergaya Pokémon di browser. Jelajahi hutan, hadapi monster, dan temui NPC untuk mendapatkan cincin legendaris.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 md:p-6">
        <section className="rounded-xl border border-white/10 bg-black/30 p-3 md:p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg md:text-2xl font-semibold">Mainkan sekarang</h2>
            <div className="text-xs md:text-sm text-white/70">Desktop & Mobile</div>
          </div>
          <div className="aspect-[16/9] w-full overflow-hidden rounded-lg border border-white/10 bg-gray-800">
            <Game />
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-black/30 p-4">
            <h3 className="font-semibold">Kontrol</h3>
            <ul className="mt-2 text-sm text-white/80 space-y-1">
              <li>A/D atau ←/→ untuk bergerak</li>
              <li>Spasi untuk lompat kecil</li>
              <li>E untuk interaksi</li>
              <li>Esc untuk pause</li>
            </ul>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/30 p-4">
            <h3 className="font-semibold">Fitur</h3>
            <ul className="mt-2 text-sm text-white/80 space-y-1">
              <li>Encounter liar, ambush, dan acak di semak</li>
              <li>Battle turn-based dengan capture</li>
              <li>Progress tersimpan otomatis</li>
            </ul>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/30 p-4">
            <h3 className="font-semibold">Audio</h3>
            <ul className="mt-2 text-sm text-white/80 space-y-1">
              <li>Musik latar hutan looping</li>
              <li>SFX langkah, serangan, capture</li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="mt-10 pb-10 text-center text-white/60 text-sm">© Pocket Grove</footer>
    </div>
  )
}
