# Use Node.js base image
FROM node:18-bullseye

# Install dependencies
RUN apt-get update && apt-get install -y \
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libgtk-3-0 \
    libgbm1 \
    libasound2 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    wget \
    dbus-x11 \
    libnotify4 \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy application source
COPY . .

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# We do NOT run as a restricted user ('electronuser') anymore 
# because setting up permissions for /dev/shm and dbus can be tricky 
# and often causes crashes in simple testing scenarios.
# Running as root in Docker for a GUI test is acceptable.

# Default command
CMD ["/app/entrypoint.sh"]
