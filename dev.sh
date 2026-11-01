#!/bin/bash
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Start API server on port 3001
(
  cd "$ROOT_DIR/artifacts/api-server" || exit 1
  export PORT=3001
  export NODE_ENV=development
  npm run dev
) &

# Start Vite frontend on port 3000
(
  cd "$ROOT_DIR/artifacts/fileit" || exit 1
  export PORT=3000
  npm run dev
) &

wait
