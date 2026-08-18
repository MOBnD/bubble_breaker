# 背景画像のクレジット

`src/assets/ngc-3324-2000.png` はNASA、ESA、CSA、STScIによるNGC 3324（カリーナ星雲の「宇宙の崖」）の画像を、Webb公式配布ページから取得したものです。

- 出典: [NASA Science — Cosmic Cliffs in the Carina Nebula (NIRCam and MIRI Composite)](https://science.nasa.gov/asset/webb/cosmic-cliffs-in-the-carina-nebula-nircam-and-miri-composite-compass-image/)
- クレジット: NASA, ESA, CSA, STScI
- 利用方法: ビルド時にPNGをbase64のdata URIへ変換し、`dist/bb_proto4.html`のNGC 3324内向き写真ドームへ埋め込みます。
