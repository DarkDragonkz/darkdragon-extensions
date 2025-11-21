import { Chapter, ChapterDetails, HomeSection, PartialSourceManga, SourceManga } from '@paperback/types';
export declare class WeebCentralParser {
    parseMangaDetails($: any, mangaId: string): SourceManga;
    parseChapters($: any, mangaId: string): Chapter[];
    parseChapterDetails($: any, mangaId: string, chapterId: string): ChapterDetails;
    parseSearchResults($: any): PartialSourceManga[];
    parseHomeSections($: any, sectionCallback: (section: HomeSection) => void): void;
}
