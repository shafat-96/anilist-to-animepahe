import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import AnimeMapper from './mapper.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const mapper = new AnimeMapper();

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'AniList AnimePahe Mapper API is running' });
});

// Get episodes from AniList ID
app.get('/api/:aniListId', async (req, res) => {
    try {
        const { aniListId } = req.params;
        if (!aniListId) {
            return res.status(400).json({ error: 'AniList ID is required' });
        }

        const episodes = await mapper.getEpisodesFromAniListId(parseInt(aniListId));
        res.json(episodes);
    } catch (error) {
        console.error('Error:', error.message);
        res.status(error.message.includes('not found') ? 404 : 500)
           .json({ error: error.message });
    }
});

// Get episode sources
app.get('/api/episode/:episodeId(*)', async (req, res) => {
    try {
        const { episodeId } = req.params;
        const sources = await mapper.getEpisodeSources(episodeId);
        res.json(sources);
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: 'Failed to get episode sources' });
    }
});

// For local development
if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

// For Vercel
export default app; 