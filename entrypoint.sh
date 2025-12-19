#!/bin/bash

# Start DBus daemon
mkdir -p /var/run/dbus
dbus-daemon --system --fork

# Check if we have a display
if [ -z "$DISPLAY" ]; then
    echo "WARNING: No \$DISPLAY environment variable found."
    echo "The app will likely fail to open a window."
    echo "If running on Windows, make sure to:"
    echo "1. Install VcXsrv (XLaunch)"
    echo "2. Run 'docker run' with '-e DISPLAY=host.docker.internal:0.0'"
fi

# Run the application
# --disable-gpu and --no-sandbox are crucial for Docker stability
exec npx electron . --no-sandbox --disable-gpu --disable-dev-shm-usage "$@"
