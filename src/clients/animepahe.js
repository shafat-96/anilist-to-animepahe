import fetch from 'node-fetch';
import { parse } from 'node-html-parser';

class AnimePaheClient {
    constructor() {
        this.baseUrl = 'https://animepahe.ru';
        this.headers = {
            'Cookie': '__ddg1_=;__ddg2_=;',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        };
    }

    async searchAnime(query) {
        try {
            const response = await fetch(`${this.baseUrl}/api?m=search&l=8&q=${encodeURIComponent(query)}`, {
                headers: this.headers
            });
            const data = await response.json();
            
            return data.data.map(item => ({
                name: item.title,
                poster: item.poster,
                id: `${item.id}-${item.title}`,
                episodes: {
                    sub: item.episodes,
                    dub: '??'
                }
            }));
        } catch (error) {
            console.error('AnimePahe search error:', error);
            throw error;
        }
    }

    async getEpisodes(animeId) {
        try {
            const [id, title] = animeId.split('-');
            const session = await this._getSession(title, id);
            return this._fetchAllEpisodes(session);
        } catch (error) {
            console.error('AnimePahe episodes error:', error);
            throw error;
        }
    }

    async _getSession(title, animeId) {
        const response = await fetch(`${this.baseUrl}/api?m=search&q=${encodeURIComponent(title)}`, {
            headers: this.headers
        });
        const data = await response.json();
        const session = data.data.find(
            anime => anime.title === title
        ) || data.data[0];

        return session.session;
    }

    async _fetchAllEpisodes(session, page = 1, allEpisodes = []) {
        const response = await fetch(
            `${this.baseUrl}/api?m=release&id=${session}&sort=episode_desc&page=${page}`,
            { headers: this.headers }
        );
        const data = await response.json();

        const episodes = data.data.map(item => ({
            title: `Episode ${item.episode}`,
            episodeId: `${session}/${item.session}`,
            number: item.episode,
            image: item.snapshot
        }));

        allEpisodes.push(...episodes);

        if (page < data.last_page) {
            return this._fetchAllEpisodes(session, page + 1, allEpisodes);
        }

        // Fetch anime title
        const animeResponse = await fetch(
            `${this.baseUrl}/a/${data.data[0].anime_id}`,
            { headers: this.headers }
        );
        const html = await animeResponse.text();
        const titleMatch = html.match(/<span class="title-wrapper">([^<]+)<\/span>/);
        const animeTitle = titleMatch ? titleMatch[1].trim() : 'Could not fetch title';

        return {
            title: animeTitle,
            session: session,
            totalEpisodes: data.total,
            episodes: allEpisodes.reverse()
        };
    }

    async getEpisodeSources(episodeUrl) {
        try {
            const [session, episodeSession] = episodeUrl.split('/');
            const response = await fetch(`${this.baseUrl}/play/${session}/${episodeSession}`, {
                headers: this.headers
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch episode: ${response.status}`);
            }

            const html = await response.text();
            const root = parse(html);
            const buttons = root.querySelectorAll('#resolutionMenu button');
            
            const videoLinks = [];
            for (const button of buttons) {
                const quality = button.text.trim();
                const kwikLink = button.getAttribute('data-src');
                
                if (kwikLink) {
                    const videoUrl = await this._extractKwikVideo(kwikLink);
                    videoLinks.push({
                        quality: quality,
                        url: videoUrl,
                        referer: 'https://kwik.cx'
                    });
                }
            }

            // Sort by quality
            const qualityOrder = {
                '1080p': 1,
                '720p': 2,
                '480p': 3,
                '360p': 4
            };

            videoLinks.sort((a, b) => {
                const qualityA = qualityOrder[a.quality.replace(/.*?(\d+p).*/, '$1')] || 999;
                const qualityB = qualityOrder[b.quality.replace(/.*?(\d+p).*/, '$1')] || 999;
                return qualityA - qualityB;
            });

            const sources = videoLinks.map(link => ({
                url: link.url,
                quality: link.quality,
                referer: link.referer
            }));

            return {
                sources: sources.length > 0 ? [{ url: sources[0].url }] : [],
                multiSrc: sources
            };
        } catch (error) {
            console.error('Error getting episode sources:', error);
            throw error;
        }
    }

    async _extractKwikVideo(url) {
        try {
            // First request to get the Kwik page
            const response = await fetch(url, {
                headers: {
                    ...this.headers,
                    'Referer': this.baseUrl
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch Kwik page: ${response.status}`);
            }

            const html = await response.text();
            
            // Extract and evaluate the obfuscated script using the correct regex
            const scriptMatch = /(eval)(\(f.*?)(\n<\/script>)/s.exec(html);
            if (!scriptMatch) {
                throw new Error('Could not find obfuscated script');
            }

            const evalCode = scriptMatch[2].replace('eval', '');
            const deobfuscated = eval(evalCode);
            const m3u8Match = deobfuscated.match(/https.*?m3u8/);
            
            if (m3u8Match && m3u8Match[0]) {
                return m3u8Match[0];
            }

            return url;
        } catch (error) {
            console.error('Error extracting Kwik video:', error);
            return url;
        }
    }

    _organizeStreamLinks(links) {
        const result = { sub: [], dub: [] };
        const qualityOrder = ['1080p', '720p', '480p', '360p'];

        for (const link of links) {
            const isDub = link.quality.toLowerCase().includes('eng');
            const targetList = isDub ? result.dub : result.sub;
            targetList.push(link.url);
        }

        for (const type of ['sub', 'dub']) {
            result[type].sort((a, b) => {
                const qualityA = qualityOrder.indexOf(a.match(/\d+p/)?.[0] || '');
                const qualityB = qualityOrder.indexOf(b.match(/\d+p/)?.[0] || '');
                return qualityA - qualityB;
            });
        }

        return result;
    }
}

export default AnimePaheClient; 