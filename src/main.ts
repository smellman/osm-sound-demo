import './style.scss'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Map } from 'maplibre-gl'
import {
  ListItem,
  Release,
  Track,
  fetchAllReleases,
  fetchReleaseById,
} from './otherman-records'
//import * as bootstrap from 'bootstrap'
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

  let audio: HTMLAudioElement | null = null

  const loadSound = (url: string) => {
    // play silent
    playSilence()

    // Streaming audio
    audio = new Audio(url)
    audio.crossOrigin = 'anonymous'
    const source = context.createMediaElementSource(audio);
    source.connect(analyser);
    source.connect(context.destination);
    audio.play().then(() => {
      loaded = true;
      musicBuffer = context.createBuffer(1, 1, 22050); // Dummy buffer to avoid null checks later
      if (playing) {
        play(musicBuffer);
      }
    }).catch(error => {
      console.error('Error playing audio:', error);
    });
    audio.addEventListener('ended', () => {
      console.log('Audio ended, playing next track');
      playNext();
    }, false);
  }
  let dataArray: Uint8Array | null = null

  const changeRelease = (id: string) => {
    console.log('Changing release to:', id);
    if (currentRelease !== null && currentRelease.id === id) {
      return; // No change if the same release is selected
    }
    fetchReleaseById(id).then(release => {
      if (release) {
        console.log('Fetched release:', release);
        if (currentRelease == null || currentRelease.id !== release.id) {
          currentRelease = release;
          currentTrack = release.tracklist[0] || null;
          stopTrack(); // Stop any currently playing track
        }
      } else {
        console.error('Release not found:', id);
      }
    }).catch(error => {
      console.error('Error fetching release:', error);
    });
  }

  const releaseList = document.getElementById('release-list') as HTMLDivElement;
  const select = releaseList.querySelector('select') as HTMLSelectElement;
  select.addEventListener('change', (event) => {
    const selectedId = (event.target as HTMLSelectElement).value;
    if (selectedId) {
      changeRelease(selectedId);
    }
  });
  map.on('load', () => {
    // fetch Otherman Records releases
    fetchAllReleases().then(releases => {
      releases.forEach((release: ListItem) => {
        const option = document.createElement('option');
        option.value = release.id;
        option.textContent = `[${release.id}] ${release.title}`;
        select.appendChild(option);
      });
    });

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
  const soundStatus = document.getElementById('sound-status') as HTMLDivElement
  const title = document.getElementById('current-track') as HTMLSpanElement
  const link = document.getElementById('current-link') as HTMLAnchorElement
  if (playButton) {
    playButton.addEventListener('click', () => {
      console.log('Play button clicked, playing:', playing);
      if (!playing) {
        playTrack()
      } else {
        stopTrack()
      }
    }, false);
  }

  const setupProxyUrl = (url: string) => {
    const urlObj = url.split("//")
    if (urlObj.length > 1) {
      return proxyURL + encodeURIComponent(urlObj[1])
    }
    return url
  }

  const playTrack = () => {
    if (currentTrack) {
      currentUrl = setupProxyUrl(currentTrack.url) //currentTrack.url.replace("http://", "https://")
      currentTitle = `${currentTrack.title} / ${currentRelease?.artist1} ${currentRelease?.artist2 ? currentRelease.artist2 : ""}`
      currentLink = linkBase + currentRelease!.id
      currentMD5 = currentTrack.md5 || ""
      soundStatus.style.display = 'block'
      title.textContent = currentTitle
      link.href = currentLink
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
      console.log('Play button clicked, stopping:', currentTrack);
    }
  }

  const stopTrack = () => {
    soundStatus.style.display = 'none'
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
      if (playing) {
        stopTrack()
        playTrack()
      }
    }
  }

  const nextButton = document.getElementById('next-button') as HTMLButtonElement
  if (nextButton) {
    nextButton.addEventListener('click', () => {
      console.log('Next button clicked');
      playNext()
    })
  }

  const previousButton = document.getElementById('prev-button') as HTMLButtonElement
  if (previousButton) {
    previousButton.addEventListener('click', () => {
      console.log('Previous button clicked');
      playPrevious()
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
})
