import { Chapter, ChapterDetails, HomeSection, SourceManga, PartialSourceManga, TagSection } from '@paperback/types';
export declare class Parser {
    parseMangaDetails($: any, mangaId: string, source: any): SourceManga;
    parseChapters($: any, mangaId: string, source: any): Chapter[];
    parseChapterDetails($: any, mangaId: string, id: string, source: any): Promise<ChapterDetails>;
    parseSearchResults($: any, source: any): PartialSourceManga[];
    parseTags($: any): TagSection[];
    parseHomeSections($: any, $$: any, sectionCallback: (section: HomeSection) => void, source: any): Promise<void>;
    filterUpdatedManga($: any, time: Date, ids: string[], source: any): string[];
    getImage(url: string, source: any): Promise<string[]>;
}
