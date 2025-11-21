"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = void 0;
const types_1 = require("@paperback/types");
class Parser {
    parseMangaDetails($, mangaId) {
        var _a, _b, _c, _d, _e;
        const title = (_a = $('.name.bigger').text().trim()) !== null && _a !== void 0 ? _a : '';
        const image = (_b = $('.thumb.mb-3.text-center img').attr('src')) !== null && _b !== void 0 ? _b : '';
        const desc = (_c = $('#noidungm').text().trim()) !== null && _c !== void 0 ? _c : '';
        let hentai = false;
        let author = '';
        let artist = '';
        const id_arr = [];
        const label_arr = [];
        let i = 0;
        for (const obj of $('.meta-data.row.px-1 .col-12').toArray()) {
            switch (i) {
                case 1:
                    $(obj)
                        .find('a')
                        .each((_, e) => {
                        var _a, _b;
                        label_arr.push($(e).text());
                        id_arr.push((_b = (_a = $(e).attr('href')) === null || _a === void 0 ? void 0 : _a.replace('https://www.mangaworld.in/archive?genre=', '')) !== null && _b !== void 0 ? _b : '');
                    });
                    break;
                case 2:
                    author = $(obj).text().trim().replace('Autore: ', '');
                    break;
                case 3:
                    artist = $(obj).text().trim().replace('Artista: ', '');
                    break;
            }
            i++;
        }
        const status = 'Ongoing';
        const arrayTags = [];
        for (const j in label_arr) {
            const id = (_d = id_arr[j]) !== null && _d !== void 0 ? _d : '';
            const label = (_e = label_arr[j]) !== null && _e !== void 0 ? _e : '';
            if (['ADULTI', 'SMUT', 'MATURO', 'HENTAI'].includes(id.toUpperCase()))
                hentai = true;
            if (!id || !label)
                continue;
            arrayTags.push({ id: id, label: label });
        }
        const tagSections = [App.createTagSection({ id: '0', label: 'genres', tags: arrayTags.map((x) => App.createTag(x)) })];
        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image,
                status,
                artist,
                rating: 0,
                author,
                tags: tagSections,
                desc,
                hentai,
            }),
        });
    }
    parseChapters($, mangaId, source) {
        var _a, _b, _c, _d;
        const chapters = [];
        const arrChapters = $('.chapter').toArray().reverse();
        for (const item of arrChapters) {
            const id = (_b = (_a = $('a', item).attr('href')) === null || _a === void 0 ? void 0 : _a.replace(`${source.baseUrl}/manga/${mangaId}/read/`, '')) !== null && _b !== void 0 ? _b : '';
            const name = (_c = $('a', item).attr('title')) !== null && _c !== void 0 ? _c : '';
            const chapNum = (_d = Number($('.d-inline-block', item).text().split(' ')[1])) !== null && _d !== void 0 ? _d : -1;
            chapters.push(App.createChapter({
                id,
                name,
                chapNum,
                time: new Date(Date.now()),
                langCode: 'it',
            }));
        }
        return chapters;
    }
    parseChapterDetails($, mangaId, id) {
        const pages = [];
        for (const item of $('.col-12.text-center.position-relative img').toArray()) {
            const imageUrl = $(item).attr('src');
            if (!imageUrl)
                continue;
            pages.push(imageUrl.trim());
        }
        return App.createChapterDetails({
            id,
            mangaId,
            pages,
        });
    }
    parseTags($, baseUrl) {
        var _a, _b;
        const genres = [];
        let first_label = '';
        let i = 0;
        for (const item of $('.dropdown-menu.dropdown-multicol .dropdown-item').toArray()) {
            const id = (_b = (_a = $(item).attr('href')) === null || _a === void 0 ? void 0 : _a.replace(`${baseUrl}/archive?genre=`, '')) !== null && _b !== void 0 ? _b : '';
            const label = $(item).text().trim();
            if (i == 0)
                first_label = label;
            if (label == first_label && i > 0)
                break;
            genres.push(App.createTag({ label: label, id: id }));
            i++;
        }
        return [App.createTagSection({ id: '0', label: 'Generi', tags: genres })];
    }
    parseSearchResults($) {
        var _a, _b, _c, _d, _e;
        const results = [];
        for (const item of $('.comics-grid .entry').toArray()) {
            const id = (_c = ((_b = ((_a = $('a', item).attr('href')) !== null && _a !== void 0 ? _a : '').match(/[0-9]+\/[a-zA-Z0-9\-]+/i)) !== null && _b !== void 0 ? _b : ['null'])[0]) !== null && _c !== void 0 ? _c : '';
            const title = (_d = $('a', item).attr('title')) !== null && _d !== void 0 ? _d : '';
            const image = (_e = $('a img', item).attr('src')) !== null && _e !== void 0 ? _e : '';
            results.push(App.createPartialSourceManga({
                image,
                title: title,
                mangaId: id,
                subtitle: undefined,
            }));
        }
        return results;
    }
    parseHomeSections($, sectionCallback) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        const section1 = App.createHomeSection({
            id: '1',
            title: 'Ultimi capitoli aggiunti',
            containsMoreItems: true,
            type: types_1.HomeSectionType.singleRowNormal,
        });
        const section2 = App.createHomeSection({
            id: '2',
            title: 'Manga del mese',
            containsMoreItems: false,
            type: types_1.HomeSectionType.singleRowNormal,
        });
        const section3 = App.createHomeSection({
            id: '3',
            title: 'Capitoli di tendenza',
            containsMoreItems: false,
            type: types_1.HomeSectionType.singleRowNormal,
        });
        const latestManga = [];
        const hotTitles = [];
        const trending = [];
        const arrLatest = $('.col-sm-12.col-md-8.col-xl-9 .comics-grid .entry').toArray();
        const arrHotTitle = $('.col-12 .top-wrapper .entry').toArray();
        const arrTrending = $('.entry.vertical').toArray();
        for (const obj of arrLatest) {
            const id = (_c = ((_b = ((_a = $('a', obj).attr('href')) !== null && _a !== void 0 ? _a : '').match(/[0-9]+\/[a-zA-Z0-9\-]+/i)) !== null && _b !== void 0 ? _b : ['null'])[0]) !== null && _c !== void 0 ? _c : '';
            const title = (_d = $('a', obj).attr('title')) !== null && _d !== void 0 ? _d : '';
            const image = (_e = $('a img', obj).attr('src')) !== null && _e !== void 0 ? _e : '';
            const sub = (_f = $('.d-flex.flex-wrap.flex-row a', obj).first().attr('title')) !== null && _f !== void 0 ? _f : '';
            latestManga.push(App.createPartialSourceManga({
                image,
                title: title,
                mangaId: id,
                subtitle: sub,
            }));
        }
        section1.items = latestManga;
        sectionCallback(section1);
        let i = 0;
        for (const obj of arrHotTitle) {
            const id = (_j = ((_h = ((_g = $('a', obj).attr('href')) !== null && _g !== void 0 ? _g : '').match(/[0-9]+\/[a-zA-Z0-9\-]+/i)) !== null && _h !== void 0 ? _h : ['null'])[0]) !== null && _j !== void 0 ? _j : '';
            const image = (_k = $('.img-fluid', obj).attr('src')) !== null && _k !== void 0 ? _k : '';
            const title = $('.name', obj).text().trim();
            if (i == 10)
                break;
            i++;
            hotTitles.push(App.createPartialSourceManga({
                image,
                title: title,
                mangaId: id,
                subtitle: undefined,
            }));
        }
        section2.items = hotTitles;
        sectionCallback(section2);
        for (const obj of arrTrending) {
            const id = (_o = ((_m = ((_l = $('a', obj).attr('href')) !== null && _l !== void 0 ? _l : '').match(/[0-9]+\/[a-zA-Z0-9\-]+/i)) !== null && _m !== void 0 ? _m : ['null'])[0]) !== null && _o !== void 0 ? _o : '';
            const image = (_p = $('a img', obj).attr('src')) !== null && _p !== void 0 ? _p : '';
            const title = $('.manga-title', obj).text().trim();
            trending.push(App.createPartialSourceManga({
                image,
                title: title,
                mangaId: id,
                subtitle: undefined,
            }));
        }
        section3.items = trending;
        sectionCallback(section3);
    }
    parseViewMore($) {
        var _a, _b, _c, _d, _e, _f;
        const more = [];
        const arrLatest = $('.col-sm-12.col-md-8.col-xl-9 .comics-grid .entry').toArray();
        for (const obj of arrLatest) {
            const id = (_c = ((_b = ((_a = $('a', obj).attr('href')) !== null && _a !== void 0 ? _a : '').match(/[0-9]+\/[a-zA-Z0-9\-]+/i)) !== null && _b !== void 0 ? _b : ['null'])[0]) !== null && _c !== void 0 ? _c : '';
            const title = (_d = $('a', obj).attr('title')) !== null && _d !== void 0 ? _d : '';
            const image = (_e = $('a img', obj).attr('src')) !== null && _e !== void 0 ? _e : '';
            const sub = (_f = $('.d-flex.flex-wrap.flex-row a', obj).first().attr('title')) !== null && _f !== void 0 ? _f : '';
            more.push(App.createPartialSourceManga({
                image,
                title: title,
                mangaId: id,
                subtitle: sub,
            }));
        }
        return more;
    }
}
exports.Parser = Parser;
//# sourceMappingURL=parser.js.map