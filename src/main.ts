import './style.scss'
import 'maplibre-gl/dist/maplibre-gl.css'
import { addProtocol, Map } from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import {
  ListItem,
  Release,
  Track,
  fetchAllReleases,
  fetchReleaseById,
} from './otherman-records'
import 'bootstrap'

const linkBase = "https://www.otherman-records.com/releases/"
const proxyURL = "https://proxy.smellman.org/proxy/"

let currentRelease: Release | null = null
let currentTrack: Track | null = null
let currentUrl = ""
let currentTitle = ""
let currentLink = ""
let currentMD5 = ""

const styleUrl = "https://tile.openstreetmap.jp/styles/maptiler-toner-ja/style.json"
const pmtilesUrl = "https://tile.openstreetmap.jp/static/planet.pmtiles"
let pmtilesProtocol = new Protocol()
addProtocol('pmtiles', pmtilesProtocol.tile)

let style: any = null
fetch(styleUrl).then(res=> res.json()).then(async json => {
  style = json
  style['sources']['openmaptiles'] = {
    type: "vector",
    url: "pmtiles://" + pmtilesUrl,
    attribution: '<a href="https://openmaptiles.org/" target="_blank">© OpenMapTiles</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>',
  }
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
    style: style,
    center: [139.767165, 35.680655], // Tokyo
    zoom: 16,
    pitch: 70,
    maxPitch: 85,
    hash: true,
  })

  const context = new AudioContext()
  let musicBuffer: AudioBuffer | null = null
  const bins = 16
  const analyser = context.createAnalyser()
  const gainNode = context.createGain()
  gainNode.gain.value = 1.0 // default volume
  analyser.minDecibels = -90
  analyser.maxDecibels = -10
  analyser.smoothingTimeConstant = 0.05
  analyser.fftSize = bins * 2
  let bufferSource: AudioBufferSourceNode | null = null
  let loaded = false
  let playing = false
  let flyTo = false
  let vjMode = false
  const numberOfChannels = 2
  const sampleRate = 44100

  const playSilence = () => {
    const buf = context.createBuffer(numberOfChannels, 1, sampleRate)
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

  let audio: HTMLAudioElement | null = null

  const turnOnVJMode = async () => {
    vjMode = true
    if (audio) {
      audio.pause()
      audio = null
    }
    if (bufferSource) {
      bufferSource.stop()
      bufferSource = null
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const streamSource = context.createMediaStreamSource(stream)
    streamSource.connect(gainNode)
    gainNode.connect(analyser)
    gainNode.gain.value = 1.0 // Set a default volume for VJ mode
    loaded = true
    musicBuffer = context.createBuffer(numberOfChannels, 1, sampleRate)
    playing = true
    play(musicBuffer)
    requestId = requestAnimationFrame(draw)
  }

  const loadSound = (url: string) => {
    // play silent
    playSilence()

    // Streaming audio
    audio = new Audio(url)
    audio.crossOrigin = 'anonymous'
    const source = context.createMediaElementSource(audio)
    source.connect(gainNode)
    gainNode.connect(analyser)
    gainNode.connect(context.destination)
    audio.play().then(() => {
      loaded = true
      musicBuffer = context.createBuffer(numberOfChannels, 1, sampleRate)
      if (playing) {
        play(musicBuffer)
      }
    }).catch(error => {
      console.error('Error playing audio:', error)
    })
    audio.addEventListener('ended', () => {
      console.log('Audio ended, playing next track')
      playNext()
    }, false)
  }
  let dataArray: Uint8Array | null = null

  const changeRelease = (id: string) => {
    console.log('Changing release to:', id)
    if (currentRelease !== null && currentRelease.id === id) {
      return // No change if the same release is selected
    }
    fetchReleaseById(id).then(release => {
      if (release) {
        console.log('Fetched release:', release)
        if (currentRelease == null || currentRelease.id !== release.id) {
          currentRelease = release
          currentTrack = release.tracklist[0] || null
          stopTrack() // Stop any currently playing track
          setupTitleAndLink()
        }
      } else {
        console.error('Release not found:', id)
      }
    }).catch(error => {
      console.error('Error fetching release:', error)
    })
  }

  const releaseList = document.getElementById('release-list') as HTMLDivElement
  const select = releaseList.querySelector('select') as HTMLSelectElement
  select.addEventListener('change', (event) => {
    const selectedId = (event.target as HTMLSelectElement).value
    if (selectedId) {
      changeRelease(selectedId)
    }
  })
  map.on('load', () => {
    // fetch Otherman Records releases
    fetchAllReleases().then(releases => {
      releases.forEach((release: ListItem) => {
        const option = document.createElement('option')
        option.value = release.id
        option.textContent = `[${release.id}] ${release.title} / ${release.artist1} ${release.artist2 ? release.artist2 : ""}`
        select.appendChild(option)
      })
    })

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


  const playButton = document.getElementById('play-button') as HTMLButtonElement
  const title = document.getElementById('current-track') as HTMLSpanElement
  const link = document.getElementById('current-link') as HTMLAnchorElement
  if (playButton) {
    playButton.addEventListener('click', () => {
      console.log('Play button clicked, playing:', playing)
      if (!playing) {
        playTrack()
      } else {
        stopTrack()
      }
    }, false)
  }

  const setupProxyUrl = (url: string) => {
    const urlObj = url.split("//")
    if (urlObj.length > 1) {
      return proxyURL + encodeURIComponent(urlObj[1])
    }
    return url
  }

  const setupTitleAndLink = () => {
    if (currentTrack) {
      currentTitle = `${currentTrack.title} / ${currentRelease?.artist1} ${currentRelease?.artist2 ? currentRelease.artist2 : ""}`
      currentLink = linkBase + currentRelease!.id
      currentMD5 = currentTrack.md5 || ""
      title.textContent = currentTitle
      link.href = currentLink
      link.target = "_blank"
    } else {
      currentTitle = "No track selected, please select a release."
      currentLink = "#"
      currentMD5 = ""
      title.textContent = currentTitle
      link.href = currentLink
      link.target = ""
    }
  }

  const playTrack = () => {
    if (currentTrack) {
      currentUrl = setupProxyUrl(currentTrack.url)
      if (!loaded) {
        loadSound(currentUrl)
      } else {
        playSilence()
        if (musicBuffer) {
          play(musicBuffer)
        }
      }
      requestId = requestAnimationFrame(draw)
      playButton.innerHTML = '<i class="bi bi-stop-fill"></i>'
      playing = true
    } else {
      console.log('Play button clicked, stopping:', currentTrack)
    }
  }

  const stopTrack = () => {
    if (loaded) {
      !bufferSource || bufferSource.stop()
      bufferSource = null
      loaded = false
    }
    if (audio) {
      audio.pause()
      audio.currentTime = 0
      audio = null
    }
    if (requestId) {
      cancelAnimationFrame(requestId)
      requestId = null
    }
    playButton.innerHTML = '<i class="bi bi-play-fill"></i>'
    playing = false
  }

  const playNext = () => {
    if (currentRelease) {
      const currentIndex = currentRelease.tracklist.findIndex(t => t.md5 === currentMD5)
      const nextIndex = currentIndex + 1
      const nextTrack = currentRelease.tracklist[nextIndex > currentRelease.tracklist.length - 1 ? 0 : nextIndex]
      currentTrack = nextTrack
      setupTitleAndLink()
      if (playing) {
        stopTrack()
        playTrack()
      }
    }
  }

  const playPrevious = () => {
    if (currentRelease) {
      const currentIndex = currentRelease.tracklist.findIndex(t => t.md5 === currentMD5)
      const previousIndex = currentIndex - 1
      const previousTrack = currentRelease.tracklist[previousIndex < 0 ? currentRelease.tracklist.length - 1 : previousIndex]
      currentTrack = previousTrack
      setupTitleAndLink()
      if (playing) {
        stopTrack()
        playTrack()
      }
    }
  }

  const nextButton = document.getElementById('next-button') as HTMLButtonElement
  if (nextButton) {
    nextButton.addEventListener('click', () => {
      console.log('Next button clicked')
      playNext()
    })
  }

  const previousButton = document.getElementById('prev-button') as HTMLButtonElement
  if (previousButton) {
    previousButton.addEventListener('click', () => {
      console.log('Previous button clicked')
      playPrevious()
    })
  }

  const volumeButton = document.getElementById('volume-button') as HTMLButtonElement
  if (volumeButton) {
    volumeButton.addEventListener('click', () => {
      const existing = document.getElementById('volume-control')
      if (existing) {
        existing.remove()
        return
      }
      const popup = document.createElement('div')
      popup.id = 'volume-control'
      popup.className = 'volume-control-popup'

      const range = document.createElement('input')
      range.type = 'range'
      range.min = '0'
      range.max = '1'
      range.step = '0.01'
      range.value = gainNode.gain.value.toString()
      range.addEventListener('input', () => {
        gainNode.gain.value = parseFloat(range.value)
      })
      popup.appendChild(range)
      document.body.appendChild(popup)

      const rect = volumeButton.getBoundingClientRect()
      popup.style.left = `${rect.right}px`
      popup.style.top = `${rect.top - 120 - 10}px`
    })
  }

  const flyToLinks = document.querySelectorAll('#flyTo a')
  flyToLinks.forEach(link => {
    link.addEventListener('click', () => {
      const longitude = parseFloat(link.getAttribute('data-longitude') || '0')
      const latitude = parseFloat(link.getAttribute('data-latitude') || '0')
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
  const locateButton = document.getElementById('locate-button') as HTMLButtonElement
  if (locateButton) {
    locateButton.addEventListener('click', () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
          const { latitude, longitude } = position.coords
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
        }, (error) => {
          console.error('Error getting location:', error)
        })
      } else {
        console.error('Geolocation is not supported by this browser.')
      }
    })
  }

  const vjModeButton = document.getElementById('turn-on-vj-mode') as HTMLAnchorElement
  if (vjModeButton) {
    vjModeButton.addEventListener('click', async (event) => {
      event.preventDefault()
      if (vjMode) {
        console.log('VJ Mode is already on')
        return
      }
      try {
        await turnOnVJMode()
        hideAllButtonNavbar()
        adjustMapForNavbar()
        map.removeControl
      } catch (error) {
        console.error('Error turning on VJ Mode:', error)
      }
    })
    if (navigator.mediaDevices.getUserMedia === undefined) {
      vjModeButton.style.display = 'none' // Hide button if getUserMedia is not supported
    }
  }

  const hideAllButtonNavbar = () => {
    const navbar = document.querySelector('.navbar') as HTMLDivElement
    if (navbar) {
      navbar.style.display = 'none'
    }
    const buttons = document.querySelectorAll('.btn')
    buttons.forEach(button => {
      (button as HTMLButtonElement).style.display = 'none'
    })
  }

  // Update the title and link
  setupTitleAndLink()
})

// tweek nav bar height for mobile
const adjustMapForNavbar = () => {
  const navbar = document.querySelector('.navbar') as HTMLDivElement
  const map = document.getElementById('map') as HTMLDivElement
  if (navbar && map) {
    const navbarHeight = navbar.offsetHeight
    const viewportHeight = window.innerHeight
    map.style.height = `${viewportHeight - navbarHeight}px`
  }
}

window.addEventListener('resize', adjustMapForNavbar)
window.addEventListener('orientationchange', adjustMapForNavbar)
document.addEventListener('DOMContentLoaded', adjustMapForNavbar)
