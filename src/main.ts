import './style.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Map } from 'maplibre-gl'
import memoryofthecartridge from '/3_memory-of-the-cartridge.mp3'
import glitter_original_mix from '/5_glitter_original_mix.mp3'

const music = [
  {
    name: "Ca5 / Memory of the Cartridge",
    url: memoryofthecartridge,
  },
  {
    name: "storz / Glitter (Original Mix)",
    url: glitter_original_mix,
  },
]

let currentUrl = music[0].url
let currentTItle = music[0].name

const styleUrl = "https://tile.openstreetmap.jp/styles/maptiler-toner-ja/style.json"
const terrainUrl = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
const terrainAttribution = "ArcticDEM terrain data DEM(s) were created from DigitalGlobe, Inc., imagery and funded under National Science Foundation awards 1043681, 1559691, and 1542736; / Australia terrain data © Commonwealth of Australia (Geoscience Australia) 2017; / Austria terrain data © offene Daten Österreichs – Digitales Geländemodell (DGM) Österreich; / Canada terrain data contains information licensed under the Open Government Licence – Canada; / Europe terrain data produced using Copernicus data and information funded by the European Union - EU-DEM layers; / Global ETOPO1 terrain data U.S. National Oceanic and Atmospheric Administration / Mexico terrain data source: INEGI, Continental relief, 2016; / New Zealand terrain data Copyright 2011 Crown copyright (c) Land Information New Zealand and the New Zealand Government (All rights reserved); / Norway terrain data © Kartverket; / United Kingdom terrain data © Environment Agency copyright and/or database right 2015. All rights reserved; / United States 3DEP (formerly NED) and global GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey."

let style;
fetch(styleUrl).then(res=> res.json()).then(json => {
  style = json
  style['sources']['terrain'] = {
    type: "raster-dem",
    tiles:[terrainUrl],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom: 15,
    minzoom: 1,
    attribution: terrainAttribution
  }
  style['layers'].push({
    id: 'hills',
    type: 'hillshade',
    source: 'terrain',
    paint: { 
        'hillshade-illumination-anchor': 'map',
        'hillshade-exaggeration': 0.2,
    },
  })
  style['sky'] = {
    "sky-color": "#199EF3",
    "sky-horizon-blend": 0.5,
    "horizon-color": "#ffffff",
    "horizon-fog-blend": 0.5,
    "fog-color": "#0000ff",
    "fog-ground-blend": 0.5,
    "atmosphere-blend": [
        "interpolate",
        ["linear"],
        ["zoom"],
        0,
        1,
        10,
        1,
        12,
        0
    ]
  }


  const map = new Map({
    container: 'map',
    //style: 'https://tile.openstreetmap.jp/styles/osm-bright/style.json',
    //style: 'https://tile.openstreetmap.jp/styles/maptiler-toner-ja/style.json',
    style: style,
    center: [139.767165, 35.680655], // Tokyo
    //center: [141.35079, 43.06868], // Sapporo
    //center: [132.455486, 34.394377], // 広島県民文化センター
    zoom: 16,
    pitch: 70,
    maxPitch: 85,
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
  let flyTo = false

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
    if (flyTo) {
      requestId = requestAnimationFrame(draw)
      return
    }
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

  const btn = document.getElementById('button') as HTMLButtonElement
  const soundStatus = document.getElementById('sound-status') as HTMLDivElement
  const title = document.getElementById('current-track') as HTMLSpanElement
  if (btn) {
    btn.addEventListener('click', () => {
      if (!playing) {
        soundStatus.style.display = 'block'
        title.textContent = currentTItle
        if (!loaded) {
          loadSound(currentUrl)
        } else {
          playSilence()
          if (musicBuffer) {
            play(musicBuffer)
          }
        }
        requestId = requestAnimationFrame(draw)
        btn.textContent = 'Stop'
      } else {
        soundStatus.style.display = 'none'
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

  const nextButton = document.getElementById('next') as HTMLButtonElement
  if (nextButton) {
    nextButton.addEventListener('click', () => {
      const currentIndex = music.findIndex(m => m.url === currentUrl)
      const nextIndex = (currentIndex + 1) % music.length
      currentUrl = music[nextIndex].url
      currentTItle = music[nextIndex].name
      if (playing) {
        if (loaded) {
          !bufferSource || bufferSource.stop()
          bufferSource = null
        }
        loaded = false
        playSilence()
        loadSound(currentUrl)
      }
      title.textContent = currentTItle
    })
  }

  const flyToButtons = document.querySelectorAll('#flyTo button')
  flyToButtons.forEach(button => {
    button.addEventListener('click', () => {
      const longitude = parseFloat(button.getAttribute('data-longitude') || '0')
      const latitude = parseFloat(button.getAttribute('data-latitude') || '0')
      map.flyTo({
        center: [longitude, latitude],
        zoom: 16,
        pitch: 70,
        bearing: 0,
        speed: 1.2,
        curve: 1.42,
        easing(t) {
          return t
        },
        essential: true // this animation is considered essential with respect to prefers-reduced-motion
      })
      flyTo = true
      map.once('moveend', () => {
        flyTo = false
      })
    })
  })
  let showFlyTo = false
  const flyToToggle = document.getElementById('flyToToggle') as HTMLButtonElement
  if (flyToToggle) {
    flyToToggle.addEventListener('click', () => {
      if (showFlyTo) {
        document.getElementById('flyTo')!.style.display = 'none'
      } else {
        document.getElementById('flyTo')!.style.display = 'block'
      }
      showFlyTo = !showFlyTo
    })
  }
})
