const scraper = require('../scrape');

module.exports = async (req, res) => {
    const { action, query, url } = req.query;

    try {
        if (action === 'search') {
            if (!query) throw new Error("Query parameter 'query' is required for search.");
            const results = await scraper.searchMovies(query);
            res.status(200).json(results);
        }
        else if (action === 'details') {
            if (!url) throw new Error("Query parameter 'url' is required for details.");
            const details = await scraper.getMovieDetails(url);
            res.status(200).json(details);
        }
        else if (action === 'stream') {
            if (!url) throw new Error("Query parameter 'url' is required for stream source.");
            const stream = await scraper.getStreamSource(url);
            res.status(200).json(stream);
        }
        else {
            res.status(400).json({
                error: "Invalid action. Use 'search', 'details', or 'stream'.",
                examples: [
                    "/api?action=search&query=Venom",
                    "/api?action=details&url=http://...",
                    "/api?action=stream&url=https://vidhide.org/..."
                ]
            });
        }
    } catch (error) {
        console.error("API Error:", error);
        res.status(500).json({ error: error.message });
    }
};
