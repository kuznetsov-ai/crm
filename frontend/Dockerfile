FROM node:20-alpine AS builder
WORKDIR /workspace

# Install idev-ui deps
COPY idev-ui/package*.json ./idev-ui/
RUN cd idev-ui && npm install --legacy-peer-deps

# Install frontend deps
WORKDIR /workspace/frontend
COPY frontend/package*.json ./
RUN npm ci

# Copy sources and build
COPY idev-ui/ /workspace/idev-ui/
COPY frontend/ .
RUN npx vite build

# Production: nginx serves the built files
FROM nginx:alpine
COPY --from=builder /workspace/frontend/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
