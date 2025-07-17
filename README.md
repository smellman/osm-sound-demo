# OSM Sound demo

## How to run

```bash
npm install
npm run dev
```

## License of the code

MIT License

# Demo Music

All music in this demo is from the [Otherman Records](https://www.otherman-records.com/).

## License of the music

CC BY-NC 2.1 JP

# VJ mode

## For Linux

Test on Ubuntu Studio 25.04 + PipeWire.

```bash
pactl load-module module-remap-source master=VitualSink.monitor source_name=VirtualMic source_properties=device.description=VirtualMIc
```

To check connection, please use Helvum.

![Helvum screenshot](https://i.gyazo.com/3e7d026299a4966a1c306ce6a911385f.png)

## For macOS

You need to install [https://rogueamoeba.com/loopback/](Loopback.app) and [https://github.com/ExistentialAudio/BlackHole](BlackHole).
