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
pactl load-module module-remap-source master=VirtualSink.monitor source_name=VirtualMic source_properties=device.description=VirtualMic
```

To check connection, please use Helvum.

![Helvum screenshot](https://i.gyazo.com/3e7d026299a4966a1c306ce6a911385f.png)

## For macOS

You need to install [https://rogueamoeba.com/loopback/](Loopback.app).

![Loopback screenshot](https://i.gyazo.com/051fe278806212ef0061b2d18acd7359.png)
