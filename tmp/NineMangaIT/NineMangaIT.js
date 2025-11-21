"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NineMangaIT = exports.NineMangaITInfo = void 0;
const types_1 = require("@paperback/types");
// FIX: Percorsi corretti ../ invece di ./
const NineManga_1 = require("../NineManga");
const IT_DOMAIN = 'https://it.ninemanga.com';
exports.NineMangaITInfo = {
    version: (0, NineManga_1.getExportVersion)('0.0.2'),
    name: 'NineMangaIT',
    description: 'Extension that pulls manga from it.ninemanga.com',
    author: 'NmN',
    authorWebsite: 'http://github.com/pandyenmn',
    icon: 'icon.png',
    contentRating: types_1.ContentRating.EVERYONE,
    language: 'it',
    websiteBaseURL: IT_DOMAIN,
    sourceTags: [
        {
            text: 'Italian',
            type: types_1.BadgeColor.GREY
        },
    ],
    intents: types_1.SourceIntents.MANGA_CHAPTERS | types_1.SourceIntents.HOMEPAGE_SECTIONS | types_1.SourceIntents.CLOUDFLARE_BYPASS_REQUIRED,
};
class NineMangaIT extends NineManga_1.NineManga {
    constructor() {
        super(...arguments);
        this.baseUrl = IT_DOMAIN;
        this.languageCode = 'it';
        this.genreTag = 'Genere(s)';
        this.authorTag = 'Author(s)';
        this.statusTag = 'Stato';
    }
    // Ora che parseStatus è definito in NineManga, override è valido
    parseStatus(str) {
        let status = 'Unknown';
        switch (str.toLowerCase()) {
            case 'in corso':
                status = 'Ongoing';
                break;
            case 'completato':
                status = 'Completed';
                break;
        }
        return status;
    }
    convertTime(timeAgo) {
        var _a;
        let time;
        let trimmed = Number(((_a = /\d*/.exec(timeAgo)) !== null && _a !== void 0 ? _a : [])[0]);
        trimmed = trimmed == 0 && timeAgo.includes('a') ? 1 : trimmed;
        if (timeAgo.includes('mins') || timeAgo.includes('minutes') || timeAgo.includes('minute')) {
            time = new Date(Date.now() - trimmed * 60000);
        }
        else if (timeAgo.includes('ore') || timeAgo.includes('hour')) {
            time = new Date(Date.now() - trimmed * 3600000);
        }
        else {
            time = new Date(timeAgo);
        }
        return time;
    }
}
exports.NineMangaIT = NineMangaIT;
//# sourceMappingURL=NineMangaIT.js.map