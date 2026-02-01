const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

console.log('PORT env:', process.env.PORT);
console.log('Using port:', port);

// Helper function to escape HTML to prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Helper function to replace all template placeholders with empty strings
function clearPlaceholders(html) {
    return html.replace(/\{\{[A-Z_]+\}\}/g, '');
}

// Madison, MS coordinates
const MADISON_LAT = 32.4610;
const MADISON_LON = -90.1153;

// Weather icons mapping (using SVG icons)
const weatherIcons = {
    0: { icon: 'icon-clear', label: 'Clear sky' },
    1: { icon: 'icon-partly-cloudy', label: 'Mainly clear' },
    2: { icon: 'icon-partly-cloudy', label: 'Partly cloudy' },
    3: { icon: 'icon-cloudy', label: 'Overcast' },
    45: { icon: 'icon-fog', label: 'Foggy' },
    48: { icon: 'icon-fog', label: 'Foggy' },
    51: { icon: 'icon-rain', label: 'Light drizzle' },
    53: { icon: 'icon-rain', label: 'Drizzle' },
    55: { icon: 'icon-rain', label: 'Heavy drizzle' },
    61: { icon: 'icon-rain', label: 'Light rain' },
    63: { icon: 'icon-rain', label: 'Rain' },
    65: { icon: 'icon-rain', label: 'Heavy rain' },
    71: { icon: 'icon-snow', label: 'Light snow' },
    73: { icon: 'icon-snow', label: 'Snow' },
    75: { icon: 'icon-snow', label: 'Heavy snow' },
    77: { icon: 'icon-snow', label: 'Snow' },
    80: { icon: 'icon-rain', label: 'Light rain showers' },
    81: { icon: 'icon-rain', label: 'Rain showers' },
    82: { icon: 'icon-rain', label: 'Heavy rain showers' },
    85: { icon: 'icon-snow', label: 'Snow showers' },
    86: { icon: 'icon-snow', label: 'Heavy snow showers' },
    95: { icon: 'icon-thunderstorm', label: 'Thunderstorm' },
    96: { icon: 'icon-thunderstorm', label: 'Thunderstorm with hail' },
    99: { icon: 'icon-thunderstorm', label: 'Thunderstorm with heavy hail' }
};

// Cache for weather and saint data (5 minute TTL)
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const weatherCache = { data: null, timestamp: 0 };
const saintCache = { data: null, timestamp: 0 };

// Fetch weather data from Open-Meteo API
async function fetchWeather() {
    // Check cache
    const now = Date.now();
    if (weatherCache.data && (now - weatherCache.timestamp) < CACHE_TTL) {
        return weatherCache.data;
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${MADISON_LAT}&longitude=${MADISON_LON}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&temperature_unit=fahrenheit&timezone=America/Chicago&forecast_days=8`;
    
    const response = await fetch(url);
    const weatherData = await response.json();
    
    const currentTemp = Math.round(weatherData.current.temperature_2m);
    const weatherCode = weatherData.current.weather_code;
    const high = Math.round(weatherData.daily.temperature_2m_max[0]);
    const low = Math.round(weatherData.daily.temperature_2m_min[0]);

    const iconData = weatherIcons[weatherCode] || { icon: 'icon-partly-cloudy', label: 'Partly cloudy' };

    // Get 7-day forecast (skip today, get next 7 days)
    const forecast = [];
    const maxDays = Math.min(weatherData.daily.time.length, 8);
    for (let i = 1; i < maxDays; i++) {
        const forecastWeatherCode = weatherData.daily.weather_code[i];
        const forecastIconData = weatherIcons[forecastWeatherCode] || { icon: 'icon-partly-cloudy', label: 'Partly cloudy' };
        forecast.push({
            date: weatherData.daily.time[i],
            high: Math.round(weatherData.daily.temperature_2m_max[i]),
            low: Math.round(weatherData.daily.temperature_2m_min[i]),
            icon: forecastIconData.icon,
            label: forecastIconData.label
        });
    }

    const result = {
        temp: currentTemp,
        icon: iconData.icon,
        label: iconData.label,
        high: high,
        low: low,
        forecast: forecast
    };

    // Update cache
    weatherCache.data = result;
    weatherCache.timestamp = Date.now();

    return result;
}

// Fetch liturgical day information from Antiochian API
async function fetchSaintOfTheDay() {
    // Check cache
    const now = Date.now();
    if (saintCache.data && (now - saintCache.timestamp) < CACHE_TTL) {
        return saintCache.data;
    }

    // Get access token
    const tokenResponse = await fetch('https://www.antiochian.org/connect/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'client_id=antiochian_api&client_secret=TAxhx@9tH(l%5EMgQ9FWE8%7DT@NWUT9U)&grant_type=client_credentials'
    });
    const token = await tokenResponse.json();
    const accessToken = token.access_token;

    // Get calendar dates
    const calendarResponse = await fetch('https://www.antiochian.org/api/antiochian/LiturgicalDays/CalendarDates', {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    const calendar = await calendarResponse.json();
    
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const day = currentDate.getDate();

    const calendarDay = calendar.find(x => 
        x.year === year && x.month === month && x.day === day
    );

    if (!calendarDay) {
        console.log(`Cannot find liturgical day for ${year}-${month}-${day}`);
        throw new Error('Calendar day not found');
    }

    // Get liturgical day details
    const liturgicalResponse = await fetch(`https://www.antiochian.org/api/antiochian/LiturgicalDay/${calendarDay.itemId}`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    const response = await liturgicalResponse.json();
    const liturgicalDay = response.liturgicalDay;

    const result = {
        feastDay: liturgicalDay.feastDayTitle || '',
        fasting: liturgicalDay.fasting || '',
        fastDesignation: liturgicalDay.fastDesignation || '',
        description: liturgicalDay.feastDayDescription || '',
        reading1Title: liturgicalDay.reading1Title || '',
        reading1Text: liturgicalDay.reading1FullText || '',
        reading2Title: liturgicalDay.reading2Title || '',
        reading2Text: liturgicalDay.reading2FullText || '',
        reading3Title: liturgicalDay.reading3Title || '',
        reading3Text: liturgicalDay.reading3FullText || ''
    };

    // Update cache
    saintCache.data = result;
    saintCache.timestamp = Date.now();

    return result;
}

// Serve the HTML with weather data injected
app.get('/', async (req, res) => {
    try {
        const weather = await fetchWeather();
        const saintOfTheDay = await fetchSaintOfTheDay();
        const htmlPath = path.join(__dirname, 'index.html');
        let html = fs.readFileSync(htmlPath, 'utf8');

        // Replace placeholders with weather data
        html = html.replace('{{WEATHER_TEMP}}', `<svg class="weather-icon" aria-label="${weather.label}"><use href="#${weather.icon}"></use></svg>${weather.temp}°F`);
        html = html.replace('{{WEATHER_HIGH_LOW}}', `${weather.high}° / ${weather.low}°`);
        
        // Build feast day HTML with optional fasting info
        let feastDayHtml = '';
        if (saintOfTheDay.feastDay) {
            feastDayHtml = escapeHtml(saintOfTheDay.feastDay);
            if (saintOfTheDay.fasting) {
                feastDayHtml += '<span class="fasting-info">' + escapeHtml(saintOfTheDay.fasting) + '</span>';
            }
        }
        html = html.replace('{{FEAST_DAY_TITLE}}', feastDayHtml);
        
        // Generate forecast HTML
        let forecastHtml = '';
        weather.forecast.forEach(day => {
            // Parse date explicitly to avoid timezone issues (API returns YYYY-MM-DD in America/Chicago)
            const [, month, dayOfMonth] = day.date.split('-').map(Number);
            const dateStr = `${month}/${dayOfMonth}`;
            forecastHtml += `<div class="forecast-day">
                <div class="forecast-date">${dateStr}</div>
                <div class="forecast-temps">${day.high}° / ${day.low}°</div>
                <svg class="forecast-icon" aria-label="${day.label}"><use href="#${day.icon}"></use></svg>
            </div>`;
        });
        html = html.replace('{{FORECAST}}', forecastHtml);
        
        res.send(html);
    } catch (error) {
        console.error('Error fetching weather:', error);
        let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
        html = clearPlaceholders(html);
        res.send(html);
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Clock app listening at http://0.0.0.0:${port}`);
});