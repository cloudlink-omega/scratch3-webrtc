import { defineConfig } from 'tsup'

export default defineConfig({
  name: 'webrtc', // Replace it with your extension name
  entry: ['src/index.ts', 'src/index.js'],
  target: ['esnext'],
  format: ['iife'],
  outDir: 'dist',
  banner: {
    // Replace it with your extension's metadata
    js: `// Name: WebRTC
// ID: webrtc
// Description: Barebones WebRTC implementation for Scratch.
// By: MikeDEV
// License: MIT
`
  },
  platform: 'browser',
  clean: true
})
