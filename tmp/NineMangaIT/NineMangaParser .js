"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = void 0;
const types_1 = require("@paperback/types");
class Parser {
    // FIX: Tipi di Cheerio sostituiti con any
    parseMangaDetails($, mangaId, source) {
        var _a, _b, _c, _d, _e, _f;
        const title = (_a = $('.bookface img').attr('alt')) !== null && _a !== void 0 ? _a : '';
        const image = (_b = $('.bookface img').attr('src')) !== null && _b !== void 0 ? _b : 'https://paperback.moe/icons/logo-alt.svg';
        let desc = (_c = $('.bookintro p').text().trim().replace('Summary:', '')) !== null && _c !== void 0 ? _c : '';
        if (desc == '')
            desc = `No Decscription provided by the source(${source.baseUrl})`;
        let author = '';
        let status_str = '';
        let hentai = false;
        const arrayTags = [];
        const info = $('.message li').toArray();
        for (const obj of info) {
            const item = $('b', obj).text().trim().replace(':', '');
            switch (item) {
                case source.genreTag:
                    for (const e of $('a', obj).toArray()) {
                        const id = (_e = (_d = $(e).attr('href')) === null || _d === void 0 ? void 0 : _d.replace('/category/', '').replace('.html', '')) !== null && _e !== void 0 ? _e : '';
                        const label = (_f = $(e).text().trim()) !== null && _f !== void 0 ? _f : '';
                        if (['ADULT', 'SMUT', 'MATURE'].includes(id.toUpperCase()))
                            hentai = true;
                        if (!id || !label)
                            continue;
                        arrayTags.push({ id: id, label: label });
                    }
                    break;
                case source.authorTag:
                    author = $('a', obj).text().trim();
                    break;
                case source.statusTag:
                    status_str = $('a', obj).first().text().trim();
                    break;
            }
        }
        const tagSections = [App.createTagSection({ id: '0', label: 'genres', tags: arrayTags.map((x) => App.createTag(x)) })];
        const status = source.parseStatus(status_str);
        return App.createSourceManga({
            id: mangaId,
            mangaInfo: App.createMangaInfo({
                titles: [title],
                image,
                rating: 0,
                status,
                author,
                tags: tagSections,
                desc,
                hentai,
            }),
        });
    }
    parseChapters($, mangaId, source) {
        var _a, _b, _c;
        const chapters = [];
        let prevChapNum = 1;
        const arrChapters = $('.sub_vol_ul li').toArray().reverse();
        for (const obj of arrChapters) {
            const id = (_b = (_a = $('a', obj).attr('href')) === null || _a === void 0 ? void 0 : _a.replace('.html', '').replace(/\/$/, '')) !== null && _b !== void 0 ? _b : '';
            const name = (_c = $('a', obj).attr('title')) !== null && _c !== void 0 ? _c : '';
            const chapNum = prevChapNum++;
            const time = source.convertTime($('span', obj).text().trim());
            chapters.push(App.createChapter({
                id,
                name,
                chapNum,
                time,
                langCode: source.languageCode,
            }));
        }
        return chapters;
    }
    async parseChapterDetails($, mangaId, id, source) {
        var _a;
        const pages = [];
        const pageArr = $('select#page option').toArray();
        let end = '';
        let i = 0;
        for (const obj of pageArr) {
            const page = (_a = $(obj).attr('value')) !== null && _a !== void 0 ? _a : '';
            if (i == 0)
                end = page;
            if (i > 0 && page == end)
                break;
            const imagesArray = await this.getImage(`${source.baseUrl}${page}`, source);
            for (const image of imagesArray)
                pages.push(image);
            i++;
        }
        return App.createChapterDetails({
            id,
            mangaId,
            pages,
        });
    }
    parseSearchResults($, source) {
        var _a, _b, _c, _d, _e;
        const results = [];
        for (const obj of $('.direlist .bookinfo').toArray()) {
            const id = (_b = (_a = $('.bookname', obj).attr('href')) === null || _a === void 0 ? void 0 : _a.replace(`${source.baseUrl}/manga/`, '').replace('.html', '')) !== null && _b !== void 0 ? _b : '';
            const title = (_c = $('.bookname', obj).text().trim()) !== null && _c !== void 0 ? _c : '';
            const subTitle = (_d = $('.chaptername', obj).text().trim().replace(title, '').trim()) !== null && _d !== void 0 ? _d : '';
            const image = (_e = $('dt img', obj).attr('src')) !== null && _e !== void 0 ? _e : '';
            results.push(App.createPartialSourceManga({
                image,
                title: title,
                mangaId: id,
                subtitle: subTitle,
            }));
        }
        return results;
    }
    parseTags($) {
        var _a;
        const genres = [];
        for (const obj of $('div.typelist li.cate_list').toArray()) {
            const id = $(obj).attr('cate_id');
            const label = (_a = $(obj).text().trim()) !== null && _a !== void 0 ? _a : '';
            if (!id || !label)
                continue;
            genres.push(App.createTag({ label, id }));
        }
        return [App.createTagSection({ id: '0', label: 'genres', tags: genres })];
    }
    async parseHomeSections($, $$, sectionCallback, source) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
        const section1 = App.createHomeSection({
            id: '1',
            title: 'Latest Manga',
            containsMoreItems: false,
            type: types_1.HomeSectionType.singleRowNormal,
        });
        const section2 = App.createHomeSection({
            id: '2',
            title: 'Popular',
            containsMoreItems: false,
            type: types_1.HomeSectionType.singleRowNormal,
        });
        const section3 = App.createHomeSection({
            id: '3',
            title: 'Hot Manga',
            containsMoreItems: false,
            type: types_1.HomeSectionType.singleRowNormal,
        });
        const section4 = App.createHomeSection({
            id: '4',
            title: 'New Manga',
            containsMoreItems: false,
            type: types_1.HomeSectionType.singleRowNormal,
        });
        const popular = [];
        const hot = [];
        const latest = [];
        const newManga = [];
        const arrLatest = $$('.direlist .bookinfo').toArray();
        const arrPopular = $('.pop_update li').toArray();
        const arrHot = $('.rightbox ul:nth-child(3) li dl').toArray();
        const arrNew = $('.rightbox ul:nth-child(6) li dl').toArray();
        for (const obj of arrLatest) {
            const id = (_b = (_a = $$('.bookname', obj).attr('href')) === null || _a === void 0 ? void 0 : _a.replace(`${source.baseUrl}/manga/`, '').replace('.html', '')) !== null && _b !== void 0 ? _b : '';
            const title = (_c = $$('.bookname', obj).text().trim()) !== null && _c !== void 0 ? _c : '';
            const subTitle = (_d = $$('.chaptername', obj).text().trim().toUpperCase().replace(title.toUpperCase(), '').trim()) !== null && _d !== void 0 ? _d : '';
            const image = (_e = $$('dt img', obj).attr('src')) !== null && _e !== void 0 ? _e : '';
            latest.push(App.createPartialSourceManga({
                image,
                title: title,
                mangaId: id,
                subtitle: subTitle,
            }));
        }
        section1.items = latest;
        sectionCallback(section1);
        for (const obj of arrPopular) {
            const id = (_g = (_f = $('a', obj).attr('href')) === null || _f === void 0 ? void 0 : _f.replace(`${source.baseUrl}/manga/`, '').replace('.html', '')) !== null && _g !== void 0 ? _g : '';
            const title = (_h = $('a', obj).attr('title')) !== null && _h !== void 0 ? _h : '';
            const image = (_j = $('img', obj).attr('src')) !== null && _j !== void 0 ? _j : '';
            popular.push(App.createPartialSourceManga({
                image,
                title: title,
                mangaId: id,
                subtitle: undefined,
            }));
        }
        section2.items = popular;
        sectionCallback(section2);
        for (const obj of arrHot) {
            const id = (_l = (_k = $('a', obj).attr('href')) === null || _k === void 0 ? void 0 : _k.replace(`${source.baseUrl}/manga/`, '').replace('.html', '')) !== null && _l !== void 0 ? _l : '';
            const title = (_m = $('img', obj).attr('alt')) !== null && _m !== void 0 ? _m : '';
            const image = (_o = $('img', obj).attr('src')) !== null && _o !== void 0 ? _o : '';
            hot.push(App.createPartialSourceManga({
                image,
                title: title,
                mangaId: id,
                subtitle: undefined,
            }));
        }
        section3.items = hot;
        sectionCallback(section3);
        for (const obj of arrNew) {
            const id = (_q = (_p = $('a', obj).attr('href')) === null || _p === void 0 ? void 0 : _p.replace(`${source.baseUrl}/manga/`, '').replace('.html', '')) !== null && _q !== void 0 ? _q : '';
            const title = (_r = $('img', obj).attr('alt')) !== null && _r !== void 0 ? _r : '';
            const image = (_s = $('img', obj).attr('src')) !== null && _s !== void 0 ? _s : '';
            newManga.push(App.createPartialSourceManga({
                image,
                title: title,
                mangaId: id,
                subtitle: undefined,
            }));
        }
        section4.items = newManga;
        sectionCallback(section4);
    }
    filterUpdatedManga($, time, ids, source) {
        var _a, _b, _c;
        let passedReferenceTimePrior = false;
        let passedReferenceTimeCurrent = false;
        const updatedManga = [];
        for (const obj of $('.homeupdate li').toArray()) {
            const id = (_b = (_a = $('a', obj).attr('href')) === null || _a === void 0 ? void 0 : _a.replace(`${source.baseUrl}/manga/`, '').replace('.html', '')) !== null && _b !== void 0 ? _b : '';
            let mangaTime;
            const timeSelector = (_c = $('dd', obj).text().trim()) !== null && _c !== void 0 ? _c : '';
            // eslint-disable-next-line prefer-const
            mangaTime = source.convertTime(timeSelector !== null && timeSelector !== void 0 ? timeSelector : '');
            // Check if the date is valid, if it isn't we should skip it
            if (!mangaTime.getTime())
                continue;
            passedReferenceTimeCurrent = mangaTime <= time;
            if (!passedReferenceTimeCurrent || !passedReferenceTimePrior) {
                if (ids.includes(id)) {
                    updatedManga.push(id);
                }
            }
            else
                break;
            if (typeof id === 'undefined') {
                throw new Error(`Failed to parse homepage sections for ${source.baseUrl}/${source.homePage}/`);
            }
            passedReferenceTimePrior = passedReferenceTimeCurrent;
        }
        return updatedManga;
    }
    async getImage(url, source) {
        var _a;
        const request = source.createRequest(url);
        const response = await source.requestManager.schedule(request, 3);
        const $ = source.cheerio.load(response.data);
        const arrImages = [];
        const img = $('div.pic_box img.manga_pic').toArray();
        for (const obj of img) {
            const i = (_a = $(obj).attr('src')) !== null && _a !== void 0 ? _a : '';
            arrImages.push(i);
        }
        return arrImages;
    }
}
exports.Parser = Parser;
//# sourceMappingURL=NineMangaParser%20.js.map