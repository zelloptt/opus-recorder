#!/bin/bash
base64 < dist/encoderWorker.min.wasm > base64.txt
sed -i.bak -f src/encoderWorker.inline.js << EOF
s/BASE_64/$BASE_64/g
EOF