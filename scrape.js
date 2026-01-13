const axios = require('axios');
const cheerio = require('cheerio');
// const puppeteer = require('puppeteer'); // Removing Puppeteer
const util = require('util');
const fs = require('fs'); // Added fs

// Setup axios with browser headers
const axiosInstance = axios.create({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
    }
});

const BASE_URL = 'http://165.22.124.179/';

async function searchMovies(query) {
    try {
        const searchUrl = `${BASE_URL}?s=${encodeURIComponent(query)}&post_type=post`;
        console.log(`Searching: ${searchUrl}`);
        const { data } = await axiosInstance.get(searchUrl);
        const $ = cheerio.load(data);

        const results = [];
        // Updated selector for search results
        $('article.item').each((i, el) => {
            const title = $(el).find('.entry-title a').text().trim();
            const link = $(el).find('.entry-title a').attr('href');
            const img = $(el).find('img').attr('src');
            if (title && link) {
                results.push({ title, link, img });
            }
        });

        return results;
    } catch (error) {
        console.error('Error searching movies:', error.message);
        return [];
    }
}

async function getStreamSource(embedUrl) {
    try {
        console.log(`Getting stream source from: ${embedUrl}`);
        const response = await axiosInstance.get(embedUrl, {
            headers: {
                'Referer': BASE_URL
            }
        });
        let html = response.data; // Changed to let to allow modification

        // Debug dump
        // Adding fs require at top

        // Extract variables used in obfuscation
        let qsx = '';
        let kaken = '';

        // Check for AAEncode
        const aaEncodeMatch = html.match(/(ﾟωﾟﾉ=.*?)\s*<\/script>/s);
        if (aaEncodeMatch) {
            console.log("Found AAEncode obfuscation. Decoding...");
            let code = aaEncodeMatch[1];

            // Replace the execution with a capture
            // Pattern: (ﾟДﾟ) ['_'] ( (ﾟДﾟ) ['_']
            // We replace with: capture
            // But we need to be careful. The code defines (ﾟДﾟ) first.
            // We want to replace the LAST invocation.

            // Alternative decoding: Strip the final execution call ('_');
            // and eval to get the function, then toString() to see code.

            // Look for ('_'); at the end
            const strippedCode = code.replace(/\('_'\);\s*$/, "");

            if (strippedCode !== code) {
                console.log("Stripped execution call. Evaluating...");
                try {
                    // Eval the stripped code. It should return a Function.
                    const ret = eval(strippedCode);

                    if (typeof ret === 'function') {
                        console.log("AAEncode Decoded Successfully! Executing unpacked code...");

                        // Mock window to capture variables
                        const mockWindow = {};
                        global.window = mockWindow;

                        try {
                            // Execute the function. It contains eval(packed_code).
                            ret();
                        } catch (err) {
                            console.error("Error executing unpacked script:", err.message);
                        }

                        // Capture extracted vars
                        if (mockWindow.qsx) qsx = mockWindow.qsx;
                        if (mockWindow.kaken) kaken = mockWindow.kaken;

                        console.log(`Deep Extraction Result: qsx=${qsx ? 'FOUND' : 'MISSING'}, kaken=${kaken ? 'FOUND' : 'MISSING'}`);

                        // Cleanup
                        delete global.window;
                    } else {
                        console.log("Eval result was not a function:", typeof ret);
                    }
                } catch (e) {
                    console.error("AAEncode Strip-Eval Error:", e.message);
                }
            } else {
                console.log("Could not find ('_'); at end of AAEncode block.");
            }
        }

        // Search more flexibly
        // window.qsx = "..." or window.qsx='...'
        const qsxMatch = html.match(/window\.qsx\s*=\s*['"](.*?)['"]/);
        if (qsxMatch) qsx = qsxMatch[1];

        const kakenMatch = html.match(/window\.kaken\s*=\s*['"](.*?)['"]/);
        if (kakenMatch) kaken = kakenMatch[1];

        console.log(`Extracted vars: qsx=${qsx ? 'FOUND' : 'MISSING'}, kaken=${kaken ? 'FOUND' : 'MISSING'}`);

        if (!qsx) {
            console.log("Dumping HTML to debug_scraped.html");
            fs.writeFileSync('debug_scraped.html', html);
        }

        if (qsx) {
            const baseUrl = Buffer.from(qsx, 'base64').toString('utf8');
            console.log("Decoded Base URL:", baseUrl);

            // Construct request URL
            // Deobfuscation showed: atob(qsx) + "?p=" + window.kaken ...
            // Wait, we need to CONFIRM if kaken is the p param.
            // Also need other params (token?).

            // For now, let's just RETURN the constructed URL concept and see if we can get 
            // the actual video link by JUST visiting the embed page (maybe the m3u8 IS visible in source?)

            // VidHide usually loads via player_min.js.
            // But sometimes the m3u8 is pre-loaded or in a variable.

            // Let's check for sources array in the extracted HTML too.
            const sourcesMatch = html.match(/sources:\s*(\[{.*?}\])/s);
            if (sourcesMatch) {
                console.log("Found raw sources in HTML!");
                return sourcesMatch[1];
            }

            // If explicit API call needed:
            const apiUrl = `${baseUrl}?p=${kaken}`;
            console.log("Target API URL:", apiUrl);

            return apiUrl + " (Pending Full Decryption)";
        }

        return null;
    } catch (error) {
        console.error('Error in getStreamSource:', error.message);
        return null;
    }
}

async function getMovieDetails(url) {
    try {
        console.log(`Fetching details for: ${url}`);
        const { data } = await axiosInstance.get(url);
        const $ = cheerio.load(data);

        const title = $('h1.entry-title').text().trim();
        const synopsis = $('.entry-content p').first().text().trim();
        const episodes = [];

        $('.eplister ul li').each((i, el) => {
            const link = $(el).find('a').attr('href');
            const epNum = $(el).find('.epl-num').text();
            if (link) episodes.push({ epNum, link });
        });

        let streamLink = $('.gmr-embed-responsive iframe').attr('src');
        let videoSource = null;

        if (streamLink && streamLink.includes('vidhide.org')) {
            videoSource = await getStreamSource(streamLink);
        }

        return {
            title,
            synopsis,
            episodes,
            streamLink,
            videoSource
        };
    } catch (error) {
        console.error('Error fetching details:', error.message);
        return null;
    }
}

// Main CLI Loop
if (require.main === module) {
    (async () => {
        try {
            const query = process.argv[2];

            let targetMovie;

            if (query) {
                console.log(`Command line query: "${query}"`);
                const results = await searchMovies(query);
                if (results.length === 0) {
                    console.log("No results found.");
                    return;
                }
                console.log(`Found ${results.length} results. Picking the first one: ${results[0].title}`);
                targetMovie = results[0];
            } else {
                console.log("No query provided. Fetching recent movies from homepage...");
                const homeData = await axiosInstance.get(BASE_URL);
                const $home = cheerio.load(homeData.data);

                const recentMovies = [];
                const selector = 'article.item, .gmr-item-modulepost, .gmr-box-content';

                $home(selector).each((i, element) => {
                    const titleElem = $home(element).find('.entry-title a');
                    const title = titleElem.text().trim();
                    const link = titleElem.attr('href');
                    if (title && link) {
                        if (!recentMovies.some(m => m.link === link)) {
                            recentMovies.push({ title, link });
                        }
                    }
                });

                if (recentMovies.length > 0) {
                    console.log('\n=== Recent Movies ===');
                    recentMovies.forEach((m, i) => {
                        console.log(`${i + 1}. ${m.title}`);
                    });
                    console.log('\nTo watch a movie, run: node scrape.js "Movie Title"');
                    return;
                } else {
                    console.log("Could not find any movies on the homepage.");
                    return;
                }
            }

            if (targetMovie) {
                const details = await getMovieDetails(targetMovie.link);
                if (details) {
                    console.log('\n=== Movie Details ===');
                    console.log(`Title: ${details.title}`);
                    console.log(`Synopsis: ${details.synopsis.substring(0, 100)}...`);
                    console.log(`Total Episodes: ${details.episodes.length}`);

                    let streamUrlToScrape = details.streamLink;
                    let contextMessage = "Movie";

                    if (details.episodes.length > 0) {
                        console.log(`\nExample: Fetching Episode 1 (${details.episodes[0].epNum})...`);
                        const epOne = details.episodes[0];
                        if (epOne.link) {
                            console.log(`Navigating to episode page: ${epOne.link}`);
                            const { data: epData } = await axiosInstance.get(epOne.link);
                            const $ep = cheerio.load(epData);
                            streamUrlToScrape = $ep('.gmr-embed-responsive iframe').attr('src');
                            contextMessage = `Episode ${epOne.epNum}`;
                        }
                    }

                    if (streamUrlToScrape) {
                        console.log(`\nStream Source (${contextMessage}): ${streamUrlToScrape}`);
                        if (streamUrlToScrape.includes('vidhide.org')) {
                            console.log("Vidhide detected. Launching Deobfuscated Extractor...");
                            const finalSource = await getStreamSource(streamUrlToScrape);
                            console.log("\n>>> SUCCESS: Extracted Info <<<");
                            console.log(finalSource);

                        } else {
                            console.log("Stream source is not Vidhide (or unknown). Skipped.");
                        }
                    } else {
                        console.log("No stream iframe found on the page.");
                    }
                }
            }

        } catch (e) {
            console.error("Main loop error:", util.inspect(e, { showHidden: false, depth: null, colors: false }));
        }
    })();
}

module.exports = {
    searchMovies,
    getMovieDetails,
    getStreamSource
};
