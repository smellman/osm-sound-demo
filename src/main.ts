import './style.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Map } from 'maplibre-gl'
import memoryofthecartridge from '/3_memory-of-the-cartridge.mp3'

const map = new Map({
  container: 'map',
  //style: 'https://tile.openstreetmap.jp/styles/osm-bright/style.json',
  style: 'https://tile.openstreetmap.jp/styles/maptiler-toner-ja/style.json',
  center: [136.8816, 35.1704],
  zoom: 16,
  pitch: 55,
})

const context = new window.AudioContext()
let musicBuffer: AudioBuffer | null = null
const bins = 16
const analyser = context.createAnalyser()
analyser.minDecibels = -90
analyser.maxDecibels = -10
analyser.smoothingTimeConstant = 0.05
analyser.fftSize = bins * 2
let bufferSource: AudioBufferSourceNode | null = null
let loaded = false
let playing = false

const playSilence = () => {
  const buf = context.createBuffer(1, 1, 22050)
  const src = context.createBufferSource()
  src.buffer = buf
  src.connect(context.destination)
  src.start(0)
}

const play = (buffer: AudioBuffer) => {
  bufferSource = context.createBufferSource()
  bufferSource.buffer = buffer
  bufferSource.loop = true
  bufferSource.connect(context.destination)
  bufferSource.connect(analyser)
  bufferSource.start(context.currentTime + 0.100)
}

const loadSound = (url: string) => {
  // play silent
  playSilence()

  const request = new XMLHttpRequest()
  request.open('GET', url, true)
  request.responseType = 'arraybuffer'

  request.onload = () => {
    context.decodeAudioData(request.response, (buffer) => {
      loaded = true
      musicBuffer = buffer
      if (playing) {
        play(musicBuffer)
      }
    })
  }
  request.send()
}
let dataArray: Uint8Array | null = null

map.on('load', () => {
  const maxHeight = 200
  const binWidth = maxHeight / bins
   
  // Divide the buildings into 16 bins based on their true height, using a layer filter.
  for (let i = 0; i < bins; i++) {
    map.addLayer({
      'id': '3d-buildings-' + i,
      'source': 'openmaptiles',
      'source-layer': 'building',
      'filter': [
        'all',
        ['>', 'render_height', i * binWidth],
        ['<=', 'render_height', (i + 1) * binWidth]
      ],
      'type': 'fill-extrusion',
      'paint': {
        'fill-extrusion-color': '#aaa',
        'fill-extrusion-height': 0,
        'fill-extrusion-opacity': 0.6
      }
    })
  }
  dataArray = new Uint8Array(bins)
})

let requestId: number | null = null

const draw = (now: DOMHighResTimeStamp) => {
  if (!dataArray) {
    return
  }
  analyser.getByteFrequencyData(dataArray)
  let avg = 0
  for (let i = 0; i < bins; i++) {
    avg += dataArray[i]
    map.setPaintProperty(
      '3d-buildings-' + i,
      'fill-extrusion-height',
      10 + 4 * i + dataArray[i]
    )
  }
  avg /= bins
  map.setBearing(now / 500)
  map.setLight({
    color:
      'hsl(' +
      ((now / 100) % 360) +
      ',' +
      Math.min(50 + avg / 4, 100) +
      '%,50%)',
      intensity: Math.min(1, (avg / 256) * 10)
  })

  requestId = requestAnimationFrame(draw)
}

const btn = document.getElementById('button')
if (btn) {
  btn.addEventListener('click', () => {
    if (!playing) {
      if (!loaded) {
        loadSound(memoryofthecartridge)
      } else {
        playSilence()
        if (musicBuffer) {
          play(musicBuffer)
        }
      }
      requestId = requestAnimationFrame(draw)
      btn.textContent = 'Stop'
    } else {
      if (loaded) {
        !bufferSource || bufferSource.stop()
        bufferSource = null
      }
      if (requestId) {
        cancelAnimationFrame(requestId)
        requestId = null
      }
      btn.textContent = 'Play'
    }
    playing = !playing
  }, false);
}

