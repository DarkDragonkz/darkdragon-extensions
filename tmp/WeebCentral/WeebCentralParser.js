"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeebCentralParser = void 0;
const types_1 = require("@paperback/types");
class WeebCentralParser {
    parseMangaDetails($, mangaId) {
        var _a, _b;
        let title = $('h1').first().text().trim();
        if (!title)
            title = (_a = $('section:has(picture)').first().attr('data-tip')) !== null && _a !== void 0 ? _a : '';
        const image = (_b = $('img[alt$=" cover"]').attr('src')) !== null && _b !== void 0 ? _b : 'https://paperback.moe/icons/logo-alt.svg';
        const desc = $('strong:contains("Description")').next('p').text().trim();
        const author = $('strong:contains("Author(s)")').next().find('a').text().trim();
        const statusStr = $('strong:contains("Status")').next('a').text().trim();
        let status = 'Unknown';
        if (statusStr.toLowerCase().includes('ongoing'))
            status = 'Ongoing';
        else if (statusStr.toLowerCase().includes('complete'))
            status = 'Completed';
        const arrayTags = [];
        $('strong:contains("Tags(s)")').nextAll('span').each((_, span) => {
            const a = $('a', span);
            const id = a.text().trim();
            const label = a.text().trim();
            if (id)
                arrayTags.push({ id, label });
        });
        const tagSections = [App.createTagSection({ id: '0', label: 'Genres', tags: arrayTags.map((x) => App.createTag(x)) })];
        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image: image,
                status: status,
                author: author,
                tags: tagSections,
                desc: desc || 'No description available'
            })
        });
    }
    parseChapters($, mangaId) {
        const chapters = [];
        $('a[href*="/chapters/"]').each((_, element) => {
            const href = $(element).attr('href');
            const id = href === null || href === void 0 ? void 0 : href.split('/chapters/')[1];
            let name = $(element).find('span:contains("Chapter"), span:contains("Episode")').first().text().trim();
            if (!name)
                name = $(element).find('.grow span').first().text().trim();
            if (!name)
                name = $(element).text().trim();
            const numMatch = name.match(/(\d+(\.\d+)?)/);
            const chapNum = numMatch ? parseFloat(numMatch[0]) : 0;
            const timeStr = $(element).find('time').attr('datetime');
            const time = timeStr ? new Date(timeStr) : new Date();
            if (id) {
                chapters.push(App.createChapter({
                    id: id,
                    name: name,
                    chapNum: chapNum,
                    langCode: 'en',
                    time: time
                }));
            }
        });
        return chapters;
    }
    parseChapterDetails($, mangaId, chapterId) {
        const pages = [];
        $('img').each((_, img) => {
            const src = $(img).attr('src');
            if (src && !src.includes('logo') && !src.includes('icon')) {
                pages.push(src);
            }
        });
        return App.createChapterDetails({
            id: chapterId,
            mangaId: mangaId,
            pages: pages
        });
    }
    parseSearchResults($) {
        const results = [];
        // Cerca tutti gli articoli e i div che contengono link alle serie
        $('article, div.bg-base-100, a[href*="/series/"]').each((_, item) => {
            var _a, _b, _c;
            // Trova il link della serie
            let linkElement = $(item);
            if (!linkElement.is('a')) {
                linkElement = $('a[href*="/series/"]', item).first();
            }
            const href = linkElement.attr('href');
            if (!href)
                return; // Salta se non c'è link
            // --- FIX TITOLO INFALLIBILE ---
            // Estrae ID e Slug (Titolo) direttamente dall'URL
            // URL tipico: https://weebcentral.com/series/01J76XY7VSG3R5ANYPDWTXDVP6/One-Piece
            const parts = (_a = href.split('/series/')[1]) === null || _a === void 0 ? void 0 : _a.split('/');
            const id = parts === null || parts === void 0 ? void 0 : parts[0];
            const slug = parts === null || parts === void 0 ? void 0 : parts[1];
            // Prova a cercare l'immagine
            let image = $('img', item).attr('src');
            // Se l'elemento corrente è un link nudo (senza immagine dentro), cerca nel genitore
            if (!image)
                image = linkElement.find('img').attr('src');
            // Logica di recupero titolo
            let title = '';
            // 1. Priorità assoluta: Attributo data-tip (usato nei tooltip del sito)
            title = (_c = (_b = $(item).attr('data-tip')) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : '';
            // 2. Seconda scelta: Slug dall'URL (pulito dai trattini)
            // Trasforma "One-Piece" in "One Piece"
            if ((!title || title === 'Official') && slug) {
                title = slug.replace(/-/g, ' ');
            }
            // 3. Terza scelta: Testo dentro il link (ma ignoriamo "Official")
            if (!title || title === 'Official') {
                // Prendi il testo più grande o in grassetto
                const text = linkElement.find('.font-semibold, .text-lg').first().text().trim();
                if (text && text !== 'Official' && !text.includes('Chapter')) {
                    title = text;
                }
            }
            // Filtro finale per evitare risultati spazzatura
            if (id && title && title !== 'Official' && !title.includes('Chapter')) {
                // Evita duplicati controllando se l'ID è già stato aggiunto
                const exists = results.some(m => m.mangaId === id);
                if (!exists) {
                    results.push(App.createPartialSourceManga({
                        mangaId: id,
                        image: image !== null && image !== void 0 ? image : '',
                        title: title,
                        subtitle: undefined
                    }));
                }
            }
        });
        return results;
    }
    parseHomeSections($, sectionCallback) {
        const hotSection = App.createHomeSection({
            id: 'hot_updates',
            title: 'Hot Updates',
            containsMoreItems: false,
            type: types_1.HomeSectionType.singleRowNormal,
        });
        const latestSection = App.createHomeSection({
            id: 'latest_updates',
            title: 'Latest Updates',
            containsMoreItems: true,
            type: types_1.HomeSectionType.singleRowNormal,
        });
        // Parsing Hot Updates
        const hotManga = [];
        const hotHeader = $('h2').filter((_, el) => $(el).text().includes('Hot Updates')).first();
        const hotContainer = hotHeader.next('section');
        $('article', hotContainer).each((_, manga) => {
            var _a, _b, _c;
            const link = $('a', manga).attr('href');
            const parts = (_a = link === null || link === void 0 ? void 0 : link.split('/series/')[1]) === null || _a === void 0 ? void 0 : _a.split('/');
            const id = parts === null || parts === void 0 ? void 0 : parts[0];
            const slug = parts === null || parts === void 0 ? void 0 : parts[1];
            let title = (_b = $(manga).attr('data-tip')) === null || _b === void 0 ? void 0 : _b.trim();
            // Fallback titolo dallo slug se manca data-tip
            if (!title && slug)
                title = slug.replace(/-/g, ' ');
            if (!title)
                title = $('.text-white', manga).first().text().trim();
            const image = (_c = $('img', manga).attr('src')) !== null && _c !== void 0 ? _c : '';
            if (id && title) {
                hotManga.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: undefined
                }));
            }
        });
        hotSection.items = hotManga;
        sectionCallback(hotSection);
        // Parsing Latest Updates
        const latestManga = [];
        const latestHeader = $('h2').filter((_, el) => $(el).text().includes('Latest Updates')).first();
        const latestContainer = latestHeader.next('section');
        $('article', latestContainer).each((_, manga) => {
            var _a, _b, _c;
            const linkElement = $('a[href*="/series/"]', manga);
            const link = linkElement.attr('href');
            const parts = (_a = link === null || link === void 0 ? void 0 : link.split('/series/')[1]) === null || _a === void 0 ? void 0 : _a.split('/');
            const id = parts === null || parts === void 0 ? void 0 : parts[0];
            const slug = parts === null || parts === void 0 ? void 0 : parts[1];
            let title = (_b = $(manga).attr('data-tip')) === null || _b === void 0 ? void 0 : _b.trim();
            if ((!title || title === 'Official') && slug)
                title = slug.replace(/-/g, ' ');
            if (!title)
                title = $('.font-semibold.text-lg', manga).text().trim();
            const image = (_c = $('img', manga).attr('src')) !== null && _c !== void 0 ? _c : '';
            const chapter = $('span', manga).last().text().trim();
            if (id && title) {
                latestManga.push(App.createPartialSourceManga({
                    mangaId: id,
                    image: image,
                    title: title,
                    subtitle: chapter
                }));
            }
        });
        latestSection.items = latestManga;
        sectionCallback(latestSection);
    }
}
exports.WeebCentralParser = WeebCentralParser;
//# sourceMappingURL=WeebCentralParser.js.map