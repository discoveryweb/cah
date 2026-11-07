#!/usr/bin/env bash
# Optional: fetch a static ffmpeg build so uploads get duration, dimensions,
# preview frames and the light 720p copy. The inbox works without it.
set -euo pipefail
TARGET="${1:-/tmp/ffmpegpkg}"
python3 -m pip install --quiet --target "$TARGET" imageio-ffmpeg
python3 - "$TARGET" <<'PY'
import glob, os, sys
hits = sorted(glob.glob(os.path.join(sys.argv[1], "imageio_ffmpeg/binaries/ffmpeg-*")))
print("ffmpeg ready:", hits[-1] if hits else "not found")
PY
