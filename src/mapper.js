import AniListClient from './clients/anilist.js';
import AnimePaheClient from './clients/animepahe.js';

class AnimeMapper {
    constructor() {
        this.aniList = new AniListClient();
        this.animePahe = new AnimePaheClient();
    }

    async getEpisodesFromAniListId(aniListId) {
        try {
            // Get anime title from AniList
            const animeTitle = await this.aniList.getAnimeTitle(aniListId);
            if (!animeTitle) {
                throw new Error('Anime not found on AniList');
            }

            // Search AnimePahe for the anime
            const searchResults = await this.animePahe.searchAnime(animeTitle);
            if (!searchResults || searchResults.length === 0) {
                throw new Error('Anime not found on AnimePahe');
            }

            // Find the best match from search results
            const bestMatch = this._findBestMatch(animeTitle, searchResults);
            if (!bestMatch) {
                throw new Error('No matching anime found on AnimePahe');
            }

            // Get episodes from AnimePahe
            const episodes = await this.animePahe.getEpisodes(bestMatch.id);
            
            return {
                aniListId: aniListId,
                animePaheId: bestMatch.id,
                title: episodes.title,
                totalEpisodes: episodes.totalEpisodes,
                episodes: episodes.episodes.map(ep => ({
                    number: ep.number,
                    id: ep.episodeId,
                    title: ep.title,
                    image: ep.image
                }))
            };
        } catch (error) {
            console.error('Error mapping AniList to AnimePahe:', error);
            throw error;
        }
    }

    async getEpisodeSources(episodeId) {
        try {
            return await this.animePahe.getEpisodeSources(episodeId);
        } catch (error) {
            console.error('Error getting episode sources:', error);
            throw error;
        }
    }

    _findBestMatch(title, searchResults) {
        const normalizedTitle = title.toLowerCase().trim();
        return searchResults.find(result => 
            result.name.toLowerCase().trim() === normalizedTitle
        ) || searchResults[0]; // Fallback to first result if no exact match
    }
}

export default AnimeMapper; 