import { GraphQLClient } from 'graphql-request';

class AniListClient {
    constructor() {
        this.client = new GraphQLClient('https://graphql.anilist.co');
    }

    async searchAnime(query) {
        const searchQuery = `
            query ($search: String) {
                Page(page: 1, perPage: 8) {
                    media(search: $search, type: ANIME) {
                        id
                        title {
                            romaji
                            english
                            native
                        }
                        coverImage {
                            large
                        }
                        episodes
                        status
                    }
                }
            }
        `;

        try {
            const response = await this.client.request(searchQuery, { search: query });
            return response.Page.media.map(anime => ({
                id: anime.id,
                title: anime.title.romaji || anime.title.english,
                alternativeTitles: {
                    english: anime.title.english,
                    native: anime.title.native
                },
                coverImage: anime.coverImage.large,
                episodes: anime.episodes,
                status: anime.status
            }));
        } catch (error) {
            console.error('AniList search error:', error);
            throw error;
        }
    }

    async getAnimeDetails(id) {
        const detailsQuery = `
            query ($id: Int) {
                Media(id: $id, type: ANIME) {
                    id
                    title {
                        romaji
                        english
                        native
                    }
                    coverImage {
                        large
                    }
                    episodes
                    status
                    description
                    genres
                    averageScore
                    season
                    seasonYear
                }
            }
        `;

        try {
            const response = await this.client.request(detailsQuery, { id: parseInt(id) });
            return {
                id: response.Media.id,
                title: response.Media.title.romaji || response.Media.title.english,
                alternativeTitles: {
                    english: response.Media.title.english,
                    native: response.Media.title.native
                },
                coverImage: response.Media.coverImage.large,
                episodes: response.Media.episodes,
                status: response.Media.status,
                description: response.Media.description,
                genres: response.Media.genres,
                score: response.Media.averageScore,
                season: response.Media.season,
                seasonYear: response.Media.seasonYear
            };
        } catch (error) {
            console.error('AniList details error:', error);
            throw error;
        }
    }

    async getAnimeTitle(id) {
        const query = `
            query ($id: Int) {
                Media(id: $id, type: ANIME) {
                    title {
                        romaji
                        english
                        native
                    }
                }
            }
        `;

        try {
            const response = await this.client.request(query, { id: parseInt(id) });
            return response.Media.title.romaji || response.Media.title.english || response.Media.title.native;
        } catch (error) {
            console.error('AniList title fetch error:', error);
            throw error;
        }
    }
}

export default AniListClient; 