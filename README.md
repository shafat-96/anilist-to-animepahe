# AniList to AnimePahe Mapper API

This is a Node.js API that maps anime data between AniList and AnimePahe. It provides endpoints to search for anime and retrieve detailed information including streaming sources.

## Features

- Search anime across both AniList and AnimePahe
- Get detailed anime information from both sources
- Retrieve episode streaming sources from AnimePahe
- Title matching between services

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Create a `.env` file with your configuration (see `.env.example`)
4. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

### Search Anime
```
GET /api/search?query=<search_term>
```

### Get Anime Details
```
GET /api/anime/:aniListId/:animePaheId
```

### Get Episode Sources
```
GET /api/episode/:episodeId
```

## Response Examples

### Search Response
```json
[
  {
    "id": {
      "aniList": 123,
      "animePahe": "456-anime-title"
    },
    "title": "Anime Title",
    "alternativeTitles": {
      "english": "English Title",
      "native": "Native Title"
    },
    "coverImage": "https://example.com/image.jpg",
    "episodes": {
      "total": 12,
      "available": 12
    },
    "status": "FINISHED"
  }
]
```

### Anime Details Response
```json
{
  "id": {
    "aniList": 123,
    "animePahe": "456-anime-title"
  },
  "title": "Anime Title",
  "alternativeTitles": {
    "english": "English Title",
    "native": "Native Title"
  },
  "coverImage": "https://example.com/image.jpg",
  "description": "Anime description...",
  "episodes": {
    "total": 12,
    "available": 12,
    "list": [
      {
        "title": "Episode 1",
        "episodeId": "session/episode-id",
        "number": 1,
        "image": "https://example.com/thumbnail.jpg"
      }
    ]
  },
  "status": "FINISHED",
  "genres": ["Action", "Adventure"],
  "score": 8.5,
  "season": {
    "name": "SPRING",
    "year": 2023
  }
}
```

### Episode Sources Response
```json
{
  "sources": [
    {
      "url": "https://example.com/video.mp4"
    }
  ],
  "multiSrc": [
    {
      "quality": "1080p",
      "url": "https://example.com/video-1080p.mp4",
      "referer": "https://kwik.cx"
    }
  ]
}
```

## Note

This API is for educational purposes only. Make sure to comply with the terms of service of both AniList and AnimePahe when using their services. 