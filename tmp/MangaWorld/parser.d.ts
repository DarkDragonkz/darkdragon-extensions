import { Chapter, ChapterDetails, HomeSection, SourceManga, PartialSourceManga, TagSection } from '@paperback/types';
export declare class Parser {
    parseMangaDetails($: any, mangaId: string): SourceManga;
    parseChapters($: any, mangaId: string, source: any): Chapter[];
    parseChapterDetails($: any, mangaId: string, id: string): ChapterDetails;
    parseTags($: any, baseUrl: any): TagSection[];
    parseSearchResults($: any): PartialSourceManga[];
    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void;
    parseViewMore($: any): PartialSourceManga[];
}
