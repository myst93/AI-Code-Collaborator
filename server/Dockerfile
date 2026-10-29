FROM node:20-bookworm-slim

# Install language compilers and runtimes for multi-language execution engine
# Supports: JavaScript (Node.js built-in), Python 3, C++ (g++), Java (javac/java), Go (golang-go)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    gcc \
    g++ \
    default-jdk-headless \
    golang-go \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cache dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy server application files
COPY . .

# Ensure temp runs directory exists for code execution sandbox
RUN mkdir -p /app/temp_runs && chmod 777 /app/temp_runs

EXPOSE 5000

ENV PORT=5000 \
    NODE_ENV=production

CMD ["node", "index.js"]
