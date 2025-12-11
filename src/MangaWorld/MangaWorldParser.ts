import {
    Manga,
    Chapter,
    ChapterDetails,
    HomeSection,
    App,
    MangaStatus,
    TagSection
} from '@paperback/types';

const MW_CDN = 'https://cdn.mangaworld.mx';
const MW_DOMAIN = 'https://www.mangaworld.mx';

export class MangaWorldParser {

    // --- UTILS: Estrazione JSON nascosto ($MC) ---
    extractMcData(html: string): any {
        try {
            // Regex per catturare il contenuto dentro $MC=(window.$MC||[]).concat({...})
            // Basato sull'analisi dei file: e 
            const regex = /\$MC\=\(window\.\$MC\|\|\[\]\)\.concat\((.*)\)\<\/script\>/;
            const match = html.match(regex);
            
            if (!match || !match[1]) return null;

            const jsonString = match[1];
            const parsed = JSON.parse(jsonString);
            
            // Il JSON è frammentato in un array "w". Uniamo i pezzi.
            if (parsed.w && Array.isArray(parsed.w)) {
                let mergedData: any = {};
                for (const item of parsed.w) {
                    if (item && item.length >= 3 && typeof item[2] === 'object') {
                        mergedData = { ...mergedData, ...item[2] };
                    }
                }
                return mergedData;
            }
            return parsed;
        } catch (e) {
            console.error(`[MangaWorldParser] Error extracting JSON: ${e}`);
            return null;
        }
    }

    parseMangaDetails(data: any, mangaId: string): Manga {
        const mangaData = data.manga;
        if (!mangaData) throw new Error(`Dati non trovati per il manga: ${mangaId}`);

        // Parsing Stato
        let status = MangaStatus.ONGOING;
        if (mangaData.status === 'COMPLETED') status = MangaStatus.COMPLETED;
        if (mangaData.status === 'DROPPED') status = MangaStatus.ABANDONED;

        // Parsing Tags
        const tags: TagSection[] = [];
        if (mangaData.genres && Array.isArray(mangaData.genres)) {
            tags.push(App.createTagSection({
                id: 'genres',
                label: 'Generi',
                tags: mangaData.genres.map((g: any) => App.createTag({ id: g._id, label: g.name }))
            }));
        }

        const desc = mangaData.trama || "Nessuna descrizione disponibile.";
        const image = mangaData.image ? `${MW_CDN}/mangas/${mangaData.image.split('/').pop()}` : '';

        return App.createManga({
            id: mangaId,
            titles: [mangaData.title, ...(mangaData.extraTitles || [])],
            image: image,
            status: status,
            artist: mangaData.artist ? mangaData.artist[0] : 'Unknown',
            author: mangaData.author ? mangaData.author[0] : 'Unknown',
            desc: desc,
            tags: tags,
            rating: mangaData.vm18 ? 18 : 0
        });
    }

    parseChapterList(data: any, mangaId: string): Chapter[] {
        // Se i capitoli non sono nel JSON principale, controlliamo se esistono fallback
        // Tuttavia, basandoci sul file "Reader Capitolo.txt" , l'array "chapters" è presente.
        if (!data || !data.chapters || !Array.isArray(data.chapters)) {
            return [];
        }

        return data.chapters.map((chap: any) => {
            // Esempio nome: "Capitolo 1168" 
            const chapNum = parseFloat(chap.name.replace(/[^0-9.]/g, '')) || 0;
            
            return App.createChapter({
                id: chap._id, // ID interno univoco es. "6935ba7f652a974e100d5533" 
                name: chap.name + (chap.title ? ` - ${chap.title}` : ''),
                chapNum: chapNum,
                time: new Date(chap.createdAt),
                langCode: 'it',
                mangaId: mangaId
            });
        });
    }

    parseChapterDetails(data: any, mangaId: string, chapterId: string): ChapterDetails {
        if (!data || !data.chapter || !data.chapter.pages) {
            throw new Error('Impossibile caricare le pagine del capitolo.');
        }

        const mangaObj = data.manga;
        const volObj = data.volume;
        const chapObj = data.chapter;

        // Costruzione URL CDN basata su analisi 
        const mangaPart = `${mangaObj.slugFolder}-${mangaObj._id}`;
        const volPart = volObj ? `${volObj.slugFolder}-${volObj._id}` : 'unknown-volume'; 
        const chapPart = `${chapObj.slugFolder}-${chapObj._id}`;

        const pages: string[] = chapObj.pages.map((filename: string) => {
            return `${MW_CDN}/chapters/${mangaPart}/${volPart}/${chapPart}/${filename}`;
        });

        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        });
    }

    parseHomeSection(data: any, sectionId: string): Manga[] {
        let sourceData: any[] = [];

        // Logica basata su Homepage.txt e 
        if (sectionId === 'popular' && data.globalData?.topMangas) {
            sourceData = data.globalData.topMangas;
        } else if (sectionId === 'latest' && data.globalData?.latestMangas) {
            sourceData = data.globalData.latestMangas;
        }

        return sourceData.map((m: any) => {
            return App.createManga({
                id: `${m.linkId}/${m.slug}`, // ID Composto per navigazione sicura
                titles: [m.title],
                image: m.imageT || `${MW_CDN}/mangas/${m._id}.jpg`,
                status: MangaStatus.ONGOING,
                subtitle: m.latestChapter ? `Cap. ${m.latestChapter}` : undefined
            });
        });
    }

    // Fallback: Parsing HTML per la ricerca se l'API non è disponibile
    parseSearchResults($: any): Manga[] {
        const results: Manga[] = [];
        $('.entry').each((_: any, element: any) => {
            const link = $(element).find('a.thumb');
            const url = link.attr('href');
            const img = link.find('img').attr('src');
            const title = $(element).find('.manga-title').text().trim();

            if (!url) return;

            // Extract ID: /manga/1708/one-piece -> 1708/one-piece
            const parts = url.replace(MW_DOMAIN, '').split('/').filter(Boolean);
            const id = parts.length >= 3 ? `${parts[1]}/${parts[2]}` : parts[1];

            results.push(App.createManga({
                id: id,
                titles: [title],
                image: img || '',
                status: MangaStatus.ONGOING
            }));
        });
        return results;
    }
}