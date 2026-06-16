# Gunakan image Node.js yang ringan
FROM node:18-alpine

# Set working directory di dalam container
WORKDIR /usr/src/app

# Copy package.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy seluruh source code
COPY . .

# Expose port 80 (standar HTTP)
EXPOSE 80

# Jalankan aplikasi
CMD ["npm", "start"]
