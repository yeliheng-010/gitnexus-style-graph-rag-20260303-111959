FROM node:20-alpine

ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV NPM_CONFIG_REGISTRY=${NPM_REGISTRY}

WORKDIR /app

COPY package.json package-lock.json /app/
RUN npm ci --registry=${NPM_REGISTRY}

COPY index.html tsconfig.json vite.config.ts /app/
COPY src /app/src

EXPOSE 5173

CMD ["npm", "run", "dev"]
