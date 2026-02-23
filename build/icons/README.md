# App Icons

Place your app icons here before packaging:

| File        | Size       | Platform     |
| ----------- | ---------- | ------------ |
| `icon.png`  | 512×512    | Linux / base |
| `icon.icns` | multi-size | macOS        |
| `icon.ico`  | multi-size | Windows      |

## Generating icons from a PNG

Install `electron-icon-builder` (dev dependency) or use any icon tool:

```bash
# With electron-icon-builder:
npx electron-icon-builder --input=icon-source.png --output=./build/icons

# With ImageMagick for .ico:
magick icon-source.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico

# With iconutil on macOS for .icns:
mkdir icon.iconset
sips -z 512 512 icon-source.png --out icon.iconset/icon_512x512.png
iconutil -c icns icon.iconset
```

The source image should be at least 1024×1024 px with a transparent background.
