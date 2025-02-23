import fetch from 'node-fetch';
import { parse } from 'node-html-parser';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

class AnimePaheClient {
    constructor() {
        this.baseUrl = 'https://animepahe.ru';
    }

    getHeaders(sessionId = false) {
        return {
            'authority': 'animepahe.ru',
            'accept': 'application/json, text/javascript, */*; q=0.01',
            'accept-language': 'en-US,en;q=0.9',
            'cookie': '__ddg2_=;',
            'dnt': '1',
            'sec-ch-ua': '"Not A(Brand";v="99", "Microsoft Edge";v="121", "Chromium";v="121"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'x-requested-with': 'XMLHttpRequest',
            'referer': sessionId ? `${this.baseUrl}/anime/${sessionId}` : this.baseUrl,
            'user-agent': USER_AGENT
        };
    }

    async _makeRequest(url, options = {}) {
        const defaultOptions = {
            headers: this.getHeaders(options.sessionId),
            redirect: 'follow',
            follow: 20,
            timeout: 10000
        };

        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        let response = await fetch(url, finalOptions);
        
        if (response.status === 403) {
            // Try with a different user agent
            finalOptions.headers['user-agent'] = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
            response = await fetch(url, finalOptions);
        }

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        return response;
    }

    async searchAnime(query) {
        try {
            const response = await this._makeRequest(`${this.baseUrl}/api?m=search&l=8&q=${encodeURIComponent(query)}`, {
                headers: {
                    'Accept': 'application/json'
                }
            });

            const data = await response.json();
            
            if (!data.data || !Array.isArray(data.data)) {
                return [];
            }

            return data.data.map(item => ({
                name: item.title,
                poster: item.poster,
                id: `${item.id}-${item.title}`,
                episodes: {
                    sub: item.episodes,
                    dub: '??'
                },
                rating: item.score,
                releaseDate: item.year,
                type: item.type
            }));
        } catch (error) {
            console.error('AnimePahe search error:', error);
            return [];
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
        const response = await this._makeRequest(`${this.baseUrl}/api?m=search&q=${encodeURIComponent(title)}`, {
            headers: {
                'Accept': 'application/json'
            }
        });
        const data = await response.json();
        
        if (!data.data || !Array.isArray(data.data)) {
            throw new Error('Invalid search response');
        }

        const session = data.data.find(
            anime => anime.title === title
        ) || data.data[0];

        if (!session) {
            throw new Error('No matching anime found');
        }

        return session.session;
    }

    async _fetchAllEpisodes(session, page = 1, allEpisodes = []) {
        const response = await this._makeRequest(
            `${this.baseUrl}/api?m=release&id=${session}&sort=episode_desc&page=${page}`,
            {
                headers: {
                    'Accept': 'application/json'
                }
            }
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
        const animeResponse = await this._makeRequest(
            `${this.baseUrl}/a/${data.data[0].anime_id}`
        );
        const html = await animeResponse.text();
        const root = parse(html);
        const titleElement = root.querySelector('.title-wrapper span');
        const animeTitle = titleElement ? titleElement.text.trim() : 'Could not fetch title';

        return {
            title: animeTitle,
            session: session,
            totalEpisodes: data.total,
            episodes: allEpisodes.reverse()
        };
    }

    async getEpisodeSources(episodeUrl) {
        try {
            const response = await this._makeRequest(`${this.baseUrl}/play/${episodeUrl}`, {
                sessionId: episodeUrl.split('/')[0]
            });

            const html = await response.text();
            const root = parse(html);
            const buttons = root.querySelectorAll('#resolutionMenu button');
            
            const videoLinks = [];
            for (const button of buttons) {
                const quality = button.text.trim();
                const kwikLink = button.getAttribute('data-src');
                const audio = button.getAttribute('data-audio');
                
                if (kwikLink) {
                    const videoResult = await this._extractKwikVideo(kwikLink);
                    if (!videoResult.error) {
                        videoLinks.push({
                            quality: quality,
                            url: videoResult.url,
                            referer: 'https://kwik.cx',
                            isDub: audio === 'eng'
                        });
                    }
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

            // Organize links by sub/dub
            const organizedLinks = this._organizeStreamLinks(videoLinks);

            return {
                headers: {
                    Referer: 'https://kwik.cx/'
                },
                sources: [
                    {
                        url: organizedLinks.sub[0] || organizedLinks.dub[0]
                    }
                ],
                multiSrc: videoLinks
            };
        } catch (error) {
            console.error('Error getting episode sources:', error);
            return { sources: [], multiSrc: [] };
        }
    }

    _organizeStreamLinks(links) {
        const result = { sub: [], dub: [] };
        const qualityOrder = ['1080p', '720p', '360p'];

        for (const link of links) {
            const isDub = link.isDub;
            const targetList = isDub ? result.dub : result.sub;
            targetList.push(link.url);
        }

        // Sort by quality
        const sortByQuality = (a, b) => {
            const qualityA = qualityOrder.indexOf(a.match(/\d+p/)?.[0] || '');
            const qualityB = qualityOrder.indexOf(b.match(/\d+p/)?.[0] || '');
            return qualityB - qualityA;
        };

        result.sub.sort(sortByQuality);
        result.dub.sort(sortByQuality);

        return result;
    }

    async _extractKwikVideo(url) {
        try {
            const response = await this._makeRequest(url, {
                headers: {
                    'Referer': this.baseUrl,
                    'Host': 'kwik.si',
                    'Origin': 'https://kwik.si',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                }
            });

            const html = await response.text();
            const scriptMatch = /(eval)(\(f.*?)(\n<\/script>)/s.exec(html);
            
            if (!scriptMatch) {
                return {
                    error: true,
                    message: 'Could not find obfuscated script',
                    originalUrl: url
                };
            }

            const evalCode = scriptMatch[2].replace('eval', '');
            const deobfuscated = eval(evalCode);
            const m3u8Match = deobfuscated.match(/https.*?m3u8/);
            
            if (m3u8Match && m3u8Match[0]) {
                return {
                    error: false,
                    url: m3u8Match[0],
                    isM3U8: true,
                    originalUrl: url
                };
            }

            return {
                error: true,
                message: 'Could not extract m3u8 URL',
                originalUrl: url
            };
        } catch (error) {
            console.error('Error extracting Kwik video:', error);
            return {
                error: true,
                message: error.message,
                originalUrl: url
            };
        }
    }
}

export default AnimePaheClient; 
