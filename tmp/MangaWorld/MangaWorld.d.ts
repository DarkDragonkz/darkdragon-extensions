import { Chapter, ChapterDetails, HomeSection, PagedResults, SearchRequest, SourceInfo, SourceManga, SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding, TagSection } from '@paperback/types';
import { Parser } from './parser';
export declare const MangaWorldInfo: SourceInfo;
export declare class MangaWorld implements SearchResultsProviding, MangaProviding, ChapterProviding, HomePageSectionsProviding {
    private cheerio;
    baseUrl: string;
    constructor(cheerio: any);
    RETRIES: number;
    parser: Parser;
    requestManager: import("@paperback/types").RequestManager;
    getMangaShareUrl(mangaId: string): string;
    getMangaDetails(mangaId: string): Promise<SourceManga>;
    getChapters(mangaId: string): Promise<Chapter[]>;
    getChapterDetails(mangaId: string, chapterId: string): Promise<ChapterDetails>;
    getTags(): Promise<TagSection[]>;
    getSearchResults(query: SearchRequest, metadata: any): Promise<PagedResults>;
    getHomePageSections(sectionCallback: (section: HomeSection) => void): Promise<void>;
    getViewMoreItems(_: string, metadata: any): Promise<PagedResults>;
    protected convertTime(timeAgo: string): Date;
    getCloudflareBypassRequestAsync(): Promise<import("@paperback/types").Request>;
    constructSearchRequest(page: number, query: SearchRequest): any;
}
