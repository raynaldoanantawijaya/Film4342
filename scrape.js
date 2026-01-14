const axios = require('axios');
const cheerio = require('cheerio');
// const puppeteer = require('puppeteer'); // Removing Puppeteer
const util = require('util');
const fs = require('fs'); // Added fs

// Setup axios with browser headers
const axiosInstance = axios.create({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
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
        console.log(`Extracting stream source from: ${embedUrl}`);
        const response = await axiosInstance.get(embedUrl, {
            headers: {
                'Referer': BASE_URL
            }
        });
        let html = response.data; // Changed to let to allow modification
        console.log("HTML Length:", html.length);
        // Debug dump
        // Adding fs require at top

        // Extract variables used in obfuscation
        let qsx = '';
        let kaken = '';
        let pd = '';
        let ps = '';

        // Check for AAEncode
        const aaEncodeMatch = html.match(/(ﾟωﾟﾉ=.*?)\s*<\/script>/s);
        if (aaEncodeMatch) {
            console.log("Found AAEncode obfuscation. Decoding...");
            let code = aaEncodeMatch[1];

            const strippedCode = code.replace(/\('_'\);\s*$/, "");

            if (strippedCode !== code) {
                console.log("Stripped execution call. Evaluating...");
                try {
                    const ret = eval(strippedCode);

                    if (typeof ret === 'function') {
                        console.log("AAEncode Decoded Successfully! Executing unpacked code...");

                        const mockWindow = {};
                        global.window = mockWindow;

                        try {
                            ret();
                        } catch (err) {
                            console.error("Error executing unpacked script:", err.message);
                        }

                        // Capture extracted vars
                        console.log("MockWindow Keys:", Object.keys(mockWindow));
                        if (mockWindow.qsx) qsx = mockWindow.qsx;
                        if (mockWindow.kaken) kaken = mockWindow.kaken;
                        if (mockWindow.pd) pd = mockWindow.pd;
                        if (mockWindow.ps) ps = mockWindow.ps;

                        // Check global too
                        if (!pd && global.pd) {
                            console.log("Found pd on global!");
                            pd = global.pd;
                        }

                        console.log(`Deep Extraction Result: qsx=${qsx ? 'FOUND' : 'MISSING'}, pd=${pd ? 'FOUND' : 'MISSING'}`);

                        delete global.window;
                    }
                } catch (e) {
                    console.error("AAEncode Strip-Eval Error:", e.message);
                }
            }
        }

        // Search more flexibly
        const qsxMatch = html.match(/window\.qsx\s*=\s*['"](.*?)['"]/);
        if (qsxMatch) qsx = qsxMatch[1];

        const kakenMatch = html.match(/window\.kaken\s*=\s*['"](.*?)['"]/);
        if (kakenMatch) kaken = kakenMatch[1];

        const pdMatch = html.match(/window\.pd\s*=\s*['"]?(.*?)['"]?;/);
        if (pdMatch) pd = pdMatch[1];

        const psMatch = html.match(/window\.ps\s*=\s*['"](.*?)['"]/);
        if (psMatch) ps = psMatch[1];

        console.log(`Extracted vars: qsx=${qsx ? 'FOUND' : 'MISSING'}, kaken=${kaken ? 'FOUND' : 'MISSING'}, pd=${pd ? 'FOUND' : 'MISSING'}`);

        // Removed debug file write to improve performance

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
            // Based on analysis: url: atob(qsx) + ps
            // qsx decodes to base URL. ps (or pd?) is the suffix?
            // extracted_vars.json had 'ps' but it was empty/undefined in some runs?
            // Wait, fetch_config.js confirmed: https://s1.vidhide.org/api-config/ + qsx (as string) Worked!?
            // No, fetch_config.js confirmed that `qsx` string concatenated to base was 404/garbage?
            // Wait, Step 1797 showed status 200 for: https://s1.vidhide.org/api-config/TGhFV21tNVRjb0...
            // where `TGh...` was the `qsx` variable!
            // So API URL is Base + Qsx?

            // Re-verify Step 1821: Fetching https://s1.vidhide.org/api-config/pPEif7... (404)
            // But Step 1797: Fetching https://s1.vidhide.org/api-config/TGhFV21tNVRjb0V2... (200)
            // 
            // `TGhFV21tNVRjb0V2...` matches the `qsx` value in extracted_vars.json (Step 1637).
            // `pPEif7...` was the OLD qsx value from truncation.

            // So `qsx` IS the path param.
            // And we might need `?p=...` or similar?
            // `fetch_config.js` tried `qsx` + `?ps=` and got 200.

            const apiUrl = `${baseUrl}${qsx}`; // baseUrl is decoded from... wait.
            // Actually, `qsx` in extracted_vars is the FULL path suffix?
            // extracted qsx: "TGhFV21tNVRjb0V2..."
            // If we base64 decode it...
            // "LhEWmm5TcoEv..."

            // Let's just use the `qsx` variable AS the extra path.
            // The `baseUrl` in line 147 was `Buffer.from(qsx, 'base64').toString('utf8');`.
            // If `qsx` is "TGh...", decoding it yields garbage or a string? 
            // "TGhFV21tNVRjb0V2LH..." -> "LhEWmm5TcoEv..."
            // It doesn't look like a URL.

            // Derive p STRICTLY from kaken
            let p_param = '';
            if (kaken) {
                const kakenParts = kaken.split(',');
                // Observed pattern: kaken contains comma-separated values.
                // The relevant part seems to be the one that looks like a base64 string, often the 2nd one.
                // Session dump showed: "...,aWVh3iodRYChgVV95O2HJkEB9JeALgqvdUriUgi8kA269Wff50l55mpe9LDY28ks5IGjz0/6WYg1heSP4sGTzLw==,,"
                // So splitting by ',' gives: 
                // [0]: "ZzU2..." (looks like qsx?)
                // [1]: "aWVh..." (This is likely p!)
                // [2]: ""

                if (kakenParts.length > 1) {
                    p_param = kakenParts[1];
                }
            }

            if (!p_param) {
                console.log("Failed to derive p_param from kaken.");
                return null;
            }

            const finalApiUrl = `https://s1.vidhide.org/api-config/${qsx}?p=${p_param}&_=${Date.now()}`;
            console.log("Constructed API URL:", finalApiUrl);

            // Let's try to fetch it here to prove it works
            const apiRes = await axiosInstance.get(finalApiUrl, {
                headers: {
                    'Referer': embedUrl
                }
            });
            const apiData = apiRes.data;
            console.log("API Response Type:", typeof apiData);
            const dataStr = typeof apiData === 'object' ? JSON.stringify(apiData) : apiData.toString();
            console.log("API Response Length:", dataStr.length);
            console.log("API Response Snippet:", dataStr.substring(0, 500));

            if (apiData.sources) {
                console.log("Found sources in API response!");
                return apiData.sources;
            }

            return apiData;
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

                // Direct URL debug mode
                if (query.includes('http')) {
                    console.log("Direct URL detected. Extracting...");
                    const finalSource = await getStreamSource(query);
                    console.log("\n>>> SUCCESS: Extracted Info <<<");
                    console.log(finalSource);
                    return;
                }

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
