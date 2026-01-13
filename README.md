# VidHide Scraper & Extractor

A Node.js tool to scrape movie details and extract video stream URLs from sites using VidHide protection, specifically bypassing AAEncode obfuscation.

## Features

- **Search & Browse**: List recent movies or search by title.
- **Metadata Extraction**: Get title, synopsis, and episode lists.
- **Stream Extraction**: Automatically detects and deobfuscates VidHide player logic to retrieve the real API parameters (`qsx`, `kaken`) and stream URL.
- **No Headless Browser**: Fully removed Puppeteer dependency; runs on lightweight `axios` + `cheerio` + custom JS evaluation.

## Installation

```bash
npm install
```

## Usage

Run the scraper:

```bash
node scrape.js
```

Search for a movie:

```bash
node scrape.js "Venom"
```

## Deployment to Vercel

This project is structured (pending API wrapper) to be deployed on Vercel. 
The core logic in `scrape.js` exports:
- `searchMovies(query)`
- `getMovieDetails(url)`
- `getStreamSource(embedUrl)`

You can create an API route (e.g., `api/index.js`) to import these functions.
