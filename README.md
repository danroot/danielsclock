# Daniel's Clock

A simple clock application that displays the current time in Central Time and weather information for Madison, Mississippi.

## Features

- Analog clock with hour and minute hands
- Current date display
- Weather information (temperature, high/low, weather icon)
- Dark/light mode toggle via URL parameter (`?darkmode`)
- Server-side weather API integration (no client-side AJAX)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Open your browser and navigate to `http://localhost:3000`

## API

The weather data is fetched from the [Open-Meteo API](https://open-meteo.com/) for Madison, MS coordinates.

## Technologies

- Node.js
- Express.js
- HTML/CSS/JavaScript