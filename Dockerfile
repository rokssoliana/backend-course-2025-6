# Базовий образ Node.js
FROM node:22

# Встановлюємо робочу директорію в контейнері
WORKDIR /app

# Копіюємо package.json та package-lock.json
COPY package*.json ./

# Встановлюємо залежності
RUN npm install

# Копіюємо весь проєкт у контейнер
COPY . .

# Виставляємо порт, який слухатиме контейнер
EXPOSE 3000

# Запуск сервера
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000", "--cache", "./cache"]
