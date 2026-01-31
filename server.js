const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Madison, MS coordinates
const MADISON_LAT = 32.4610;
const MADISON_LON = -90.1153;

// Weather icons mapping (using Unicode weather symbols)
const weatherIcons = {
    0: { emoji: '☀️', label: 'Clear sky' },
    1: { emoji: '🌤️', label: 'Mainly clear' },
    2: { emoji: '⛅', label: 'Partly cloudy' },
    3: { emoji: '☁️', label: 'Overcast' },
    45: { emoji: '🌫️', label: 'Foggy' },
    48: { emoji: '🌫️', label: 'Foggy' },
    51: { emoji: '🌦️', label: 'Light drizzle' },
    53: { emoji: '🌦️', label: 'Drizzle' },
    55: { emoji: '🌧️', label: 'Heavy drizzle' },
    61: { emoji: '🌧️', label: 'Light rain' },
    63: { emoji: '🌧️', label: 'Rain' },
    65: { emoji: '🌧️', label: 'Heavy rain' },
    71: { emoji: '🌨️', label: 'Light snow' },
    73: { emoji: '🌨️', label: 'Snow' },
    75: { emoji: '🌨️', label: 'Heavy snow' },
    77: { emoji: '🌨️', label: 'Snow' },
    80: { emoji: '🌦️', label: 'Light rain showers' },
    81: { emoji: '🌧️', label: 'Rain showers' },
    82: { emoji: '🌧️', label: 'Heavy rain showers' },
    85: { emoji: '🌨️', label: 'Snow showers' },
    86: { emoji: '🌨️', label: 'Heavy snow showers' },
    95: { emoji: '⛈️', label: 'Thunderstorm' },
    96: { emoji: '⛈️', label: 'Thunderstorm with hail' },
    99: { emoji: '⛈️', label: 'Thunderstorm with heavy hail' }
};

// Fetch weather data from Open-Meteo API
async function fetchWeather() {
    return new Promise((resolve, reject) => {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${MADISON_LAT}&longitude=${MADISON_LON}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=America/Chicago&forecast_days=1`;

        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const weatherData = JSON.parse(data);
                    const currentTemp = Math.round(weatherData.current.temperature_2m);
                    const weatherCode = weatherData.current.weather_code;
                    const high = Math.round(weatherData.daily.temperature_2m_max[0]);
                    const low = Math.round(weatherData.daily.temperature_2m_min[0]);

                    const iconData = weatherIcons[weatherCode] || { emoji: '🌤️', label: 'Partly cloudy' };

                    resolve({
                        temp: currentTemp,
                        icon: iconData.emoji,
                        label: iconData.label,
                        high: high,
                        low: low
                    });
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

// Serve the HTML with weather data injected
app.get('/', async (req, res) => {
    try {
        const weather = await fetchWeather();
        const htmlPath = path.join(__dirname, 'index.html');
        let html = fs.readFileSync(htmlPath, 'utf8');

        // Replace placeholders with weather data
        html = html.replace('{{WEATHER_TEMP}}', `<span aria-label="${weather.label}">${weather.icon}</span> ${weather.temp}°F`);
        html = html.replace('{{WEATHER_HIGH_LOW}}', `H: ${weather.high}° L: ${weather.low}°`);

        res.send(html);
    } catch (error) {
        console.error('Error fetching weather:', error);
        let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
        html = html.replace('{{WEATHER_TEMP}}', 'Unable to load weather');
        html = html.replace('{{WEATHER_HIGH_LOW}}', '');
        res.send(html);
    }
});

app.listen(port, () => {
    console.log(`Clock app listening at http://localhost:${port}`);
});